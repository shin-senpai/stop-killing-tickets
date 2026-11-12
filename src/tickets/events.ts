import {
  Events,
  type Client,
  type DMChannel,
  type GuildMember,
  type NonThreadGuildBasedChannel,
  type PartialGuildMember,
} from 'discord.js';
import { isHubGuild } from '../core/hub.js';
import { logger } from '../core/logger.js';
import { findTicketByChannel, getTicket } from '../db/queries.js';
import type { TicketSide } from '../db/schema.js';
import { otherSide } from '../relay/sides.js';
import { fetchSideChannel, runStep } from './channels.js';
import { closeImmediately } from './finalize.js';
import { postNotice } from './notices.js';
import { revokeTicketAccess } from './permissions.js';
import {
  clearTicketSide,
  getOpenTicketsOfOpener,
  getTicketsWithParticipant,
  removeParticipantRows,
} from './repo.js';
import { refreshStarterMessages } from './starter.js';
import { withTicketLock } from './ticketLock.js';

/** Keyed by the side that still exists. */
const DELETED_NOTICE: Record<TicketSide, string> = {
  hub: '🔒 The ticket channel in the community server was deleted, so this ticket is closed.',
  client: '🔒 This ticket was closed by the support team.',
};

export function registerLifecycleEvents(client: Client): void {
  client.on(Events.ChannelDelete, (channel) => {
    onChannelDelete(channel).catch((error) =>
      logger.error(`Failed to handle deletion of channel ${channel.id}`, error),
    );
  });
  client.on(Events.GuildMemberRemove, (member) => {
    onMemberRemove(member).catch((error) =>
      logger.error(`Failed to handle member ${member.id} leaving ${member.guild.id}`, error),
    );
  });
}

/**
 * A manually deleted ticket channel closes the ticket. The bot's own deletions
 * (finalize, rollback) also arrive here: finalize holds the lock and marks the
 * ticket closed before releasing it, and rollback deletes the ticket row first.
 */
async function onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
  if (channel.isDMBased()) return;
  const location = findTicketByChannel(channel.id);
  if (!location || location.ticket.status === 'closed') return;
  const { ticket: found, side: deletedSide } = location;

  await withTicketLock(found.id, async () => {
    const ticket = getTicket(found.id);
    if (!ticket || ticket.status === 'closed') return;
    const remaining = clearTicketSide(ticket.id, deletedSide);
    if (!remaining) return;
    const source = otherSide(deletedSide);
    await closeImmediately(channel.client, remaining, {
      reason: 'Channel deleted',
      source,
      notice: DELETED_NOTICE[source],
    });
  });
}

async function onMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  const guildId = member.guild.id;
  if (isHubGuild(guildId)) return;

  for (const ticket of getOpenTicketsOfOpener(guildId, member.id)) {
    await postNotice(member.client, ticket, 'hub', '👋 The user left the server.');
  }
  for (const { id } of getTicketsWithParticipant(guildId, member.id)) {
    await withTicketLock(id, () => removeLeftParticipant(member.client, id, member.id));
  }
}

/** Member overwrites outlive the member, so a rejoining participant would see the ticket again. */
async function removeLeftParticipant(
  client: Client<true>,
  ticketId: number,
  userId: string,
): Promise<void> {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  removeParticipantRows(ticket.id, [userId]);
  const channel = await fetchSideChannel(client, ticket, 'client');
  if (channel) {
    await runStep(`revoke access of ${userId} in ticket ${ticket.id}`, () =>
      revokeTicketAccess(channel, userId),
    );
  }
  await refreshStarterMessages(client, ticket);
}
