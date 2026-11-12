import type { Client, GuildMember } from 'discord.js';
import { fetchHubGuild, sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import type { ClientServer, Ticket } from '../db/schema.js';
import { hubChannelName, clientChannelName, hubChannelTopic } from './names.js';
import type { CapturedFile } from './openingFiles.js';
import { allocateTicketNumber, deleteTicket, insertTicket, recordStarterMessages } from './repo.js';
import { postStarterMessages } from './starter.js';
import { createRelayWebhook } from '../relay/webhooks.js';
import { createClientTicketChannel, createHubTicketChannel } from './channels.js';

const HUB_CHANNEL_WARNING_COUNT = 450;
const HUB_CHANNEL_WARNING_INTERVAL_MS = 60 * 60 * 1000;

export interface TicketRequest {
  server: ClientServer;
  opener: GuildMember;
  subject: string;
  files: readonly CapturedFile[];
}

type Undo = () => unknown;

let lastHubChannelWarningAt = 0;

/** On failure, removes everything it made. */
export async function createTicket(client: Client<true>, request: TicketRequest): Promise<Ticket> {
  const undo: Undo[] = [];
  try {
    return await buildTicket(client, request, undo);
  } catch (error) {
    await rollBack(undo);
    throw error;
  }
}

async function buildTicket(
  client: Client<true>,
  { server, opener, subject, files }: TicketRequest,
  undo: Undo[],
): Promise<Ticket> {
  const { tag, hubCategoryId, ticketCategoryId } = server;
  if (!tag || !hubCategoryId || !ticketCategoryId) {
    throw new Error(`Client server ${server.guildId} is missing its tag or a category`);
  }
  const number = allocateTicketNumber(server.guildId);

  const clientChannel = await createClientTicketChannel({
    categoryId: ticketCategoryId,
    name: clientChannelName(number, opener.user.username),
    opener,
    staffRoleIds: server.staffRoleIds,
    number,
  });
  undo.push(() => clientChannel.delete());

  const hubGuild = await fetchHubGuild(client);
  const hubChannel = await createHubTicketChannel({
    hubGuild,
    categoryId: hubCategoryId,
    name: hubChannelName(tag, number),
    topic: hubChannelTopic(opener.guild.name, opener.user.username, opener.id, subject),
  });
  undo.push(() => hubChannel.delete());
  void warnIfHubIsNearlyFull(client, hubGuild.channels.cache.size);

  const [clientWebhook, hubWebhook] = await Promise.all([
    createRelayWebhook(clientChannel),
    createRelayWebhook(hubChannel),
  ]);

  const ticket = insertTicket({
    clientGuildId: server.guildId,
    number,
    openerId: opener.id,
    subject,
    clientChannelId: clientChannel.id,
    clientWebhookId: clientWebhook.id,
    clientWebhookToken: clientWebhook.token,
    hubChannelId: hubChannel.id,
    hubWebhookId: hubWebhook.id,
    hubWebhookToken: hubWebhook.token,
  });
  // Runs before the channel deletes (undo runs in reverse), so channel-delete handlers find no ticket.
  undo.push(() => deleteTicket(ticket.id));

  const starters = await postStarterMessages(
    client,
    ticket,
    { client: clientChannel, hub: hubChannel },
    files,
  );
  return recordStarterMessages(ticket.id, {
    clientStarterMessageId: starters.client.starterMessageId,
    hubStarterMessageId: starters.hub.starterMessageId,
    clientLastMessageId: starters.client.lastMessageId,
    hubLastMessageId: starters.hub.lastMessageId,
  });
}

async function rollBack(undo: Undo[]): Promise<void> {
  for (const step of undo.reverse()) {
    try {
      await step();
    } catch (error) {
      logger.error('Failed to roll back part of a ticket creation', error);
    }
  }
}

async function warnIfHubIsNearlyFull(client: Client<true>, channelCount: number): Promise<void> {
  if (channelCount < HUB_CHANNEL_WARNING_COUNT) return;
  if (Date.now() - lastHubChannelWarningAt < HUB_CHANNEL_WARNING_INTERVAL_MS) return;
  lastHubChannelWarningAt = Date.now();
  await sendHubLog(client, {
    content: `⚠️ The hub server has ${channelCount} of 500 channels. Close or archive tickets to make room.`,
    allowedMentions: { parse: [] },
  });
}
