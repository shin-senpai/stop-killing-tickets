import type { Client, Message, TextChannel } from 'discord.js';
import { logger } from '../core/logger.js';
import { getActiveTickets } from '../db/queries.js';
import type { Ticket, TicketSide } from '../db/schema.js';
import { fetchTicketChannel } from './channels.js';
import { handleSourceMessage } from './create.js';
import type { KeyedSerialQueue } from '../core/serialQueue.js';
import { getRelayedTicket } from './repo.js';
import { channelIdOf, lastRelayedOf } from './sides.js';

const MAX_MISSED_PER_CHANNEL = 500;
const PAGE_SIZE = 100;
const SIDES: readonly TicketSide[] = ['client', 'hub'];

interface MissedMessage {
  message: Message<true>;
  side: TicketSide;
}

/**
 * Must run before any live message is queued, so missed messages are relayed
 * first. Messages sent after the bot became ready are left to their live events.
 */
export function scheduleCatchUp(discord: Client<true>, queue: KeyedSerialQueue<number>): void {
  const cutoff = discord.readyTimestamp;
  for (const { id } of getActiveTickets()) {
    queue
      .run(id, () => catchUpTicket(discord, id, cutoff))
      .catch((error: unknown) => logger.error(`Catch-up failed for ticket ${id}`, error));
  }
}

async function catchUpTicket(discord: Client<true>, ticketId: number, cutoff: number) {
  const ticket = getRelayedTicket(ticketId);
  if (!ticket) return;

  const missed: MissedMessage[] = [];
  for (const side of SIDES) {
    const messages = await fetchMissed(discord, ticket, side);
    missed.push(...messages.map((message) => ({ message, side })));
  }
  missed.sort((a, b) => compareSnowflakes(a.message.id, b.message.id));

  for (const { message, side } of missed) {
    if (message.createdTimestamp > cutoff) continue;
    await handleSourceMessage(message, ticketId, side, { offline: true });
  }
  if (missed.length > 0) {
    logger.info(`Caught up ${missed.length} messages in ticket ${ticketId}`);
  }
}

async function fetchMissed(
  discord: Client<true>,
  ticket: Ticket,
  side: TicketSide,
): Promise<Message<true>[]> {
  const after = lastRelayedOf(ticket, side);
  if (!after) return [];
  const channel = await fetchTicketChannel(discord, channelIdOf(ticket, side));
  if (!channel) return [];

  const messages = await fetchMessagesAfter(channel, after, MAX_MISSED_PER_CHANNEL);
  if (messages.length >= MAX_MISSED_PER_CHANNEL) {
    logger.warn(
      `Ticket ${ticket.id} missed more than ${MAX_MISSED_PER_CHANNEL} ${side} messages; the rest are skipped`,
    );
  }
  return messages;
}

/** Messages after `afterId`, oldest first. */
async function fetchMessagesAfter(
  channel: TextChannel,
  afterId: string,
  max: number,
): Promise<Message<true>[]> {
  const result: Message<true>[] = [];
  let cursor = afterId;
  while (result.length < max) {
    const limit = Math.min(PAGE_SIZE, max - result.length);
    const page = await channel.messages.fetch({ after: cursor, limit, cache: false });
    const sorted = [...page.values()].sort((a, b) => compareSnowflakes(a.id, b.id));
    result.push(...sorted);
    const newest = sorted.at(-1);
    if (!newest || sorted.length < limit) break;
    cursor = newest.id;
  }
  return result;
}

function compareSnowflakes(a: string, b: string): number {
  const difference = BigInt(a) - BigInt(b);
  return difference === 0n ? 0 : difference < 0n ? -1 : 1;
}
