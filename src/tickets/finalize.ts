import {
  OverwriteType,
  PermissionFlagsBits,
  PermissionsBitField,
  type Client,
  type OverwriteData,
  type TextChannel,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import { getHubConfig, getTicket, updateTicket } from '../db/queries.js';
import type { HubConfig, Ticket, TicketSide } from '../db/schema.js';
import { deleteChannel, fetchSideChannel, runStep } from './channels.js';
import { postNotice } from './notices.js';
import { emptySide, getActiveTicketsOfClient, markTicketClosed, type TicketPatch } from './repo.js';
import { refreshStarterMessages } from './starter.js';
import { withTicketLock } from './ticketLock.js';
import { deliverTranscripts } from './transcript.js';

const DELETE_REASON = 'Ticket closed';

const WRITE_PERMISSIONS = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.AddReactions,
];

/**
 * Deletes the client channel, deletes or archives the hub channel, and marks
 * the ticket closed. Callers hold the ticket lock. The ticket is marked closed
 * even if Discord calls fail, so the scheduler does not retry every minute.
 */
export async function finalizeTicket(client: Client<true>, ticket: Ticket): Promise<void> {
  const hub = getHubConfig();
  if (ticket.clientChannelId) await removeClientChannel(client, ticket);
  const hubPatch = ticket.hubChannelId ? await retireHubChannel(client, ticket, hub) : {};
  const closed = markTicketClosed(ticket.id, {
    closedAt: ticket.closedAt ?? new Date(),
    ...emptySide('client'),
    ...hubPatch,
  });
  if (closed?.hubChannelId) await refreshStarterMessages(client, closed);
}

export interface ImmediateClose {
  reason: string;
  /** The side that gets the notice and that the transcript is built from. */
  source: TicketSide;
  notice: string;
}

/**
 * Closes a ticket without a grace period. A ticket that was already closing
 * has its transcripts. Callers hold the ticket lock.
 */
export async function closeImmediately(
  client: Client<true>,
  ticket: Ticket,
  { reason, source, notice }: ImmediateClose,
): Promise<void> {
  const wasOpen = ticket.status === 'open';
  const closed =
    updateTicket(ticket.id, {
      closedAt: ticket.closedAt ?? new Date(),
      ...(wasOpen && { closedBy: null, closeReason: reason }),
    }) ?? ticket;

  await postNotice(client, closed, source, notice, Colors.closed);
  if (wasOpen) await deliverTranscripts(client, closed, [source]);
  await finalizeTicket(client, closed);
}

/**
 * Closes every open or closing ticket of a client server, for example when the
 * bot was removed or the hub unlinked the server. Transcripts come from the
 * hub side because the client server may be unreachable.
 */
export async function forceCloseClientTickets(
  client: Client<true>,
  clientGuildId: string,
  reason: string,
): Promise<void> {
  for (const { id } of getActiveTicketsOfClient(clientGuildId)) {
    try {
      await withTicketLock(id, async () => {
        const ticket = getTicket(id);
        if (!ticket || ticket.status === 'closed') return;
        await closeImmediately(client, ticket, {
          reason,
          source: 'hub',
          notice: `🔒 Ticket closed: ${reason}`,
        });
      });
    } catch (error) {
      logger.error(`Failed to force-close ticket ${id}`, error);
    }
  }
}

async function removeClientChannel(client: Client<true>, ticket: Ticket): Promise<void> {
  const channel = await fetchSideChannel(client, ticket, 'client');
  if (channel) await deleteChannel(channel, DELETE_REASON);
}

async function retireHubChannel(
  client: Client<true>,
  ticket: Ticket,
  hub: HubConfig,
): Promise<TicketPatch> {
  const channel = await fetchSideChannel(client, ticket, 'hub');
  if (!channel) return emptySide('hub');

  if (hub.archiveMode === 'move' && hub.closedCategoryId) {
    const closedCategoryId = hub.closedCategoryId;
    const archived = await runStep(`archive hub channel ${channel.id}`, () =>
      archiveHubChannel(channel, closedCategoryId),
    );
    if (archived) {
      await deleteHubWebhook(client, ticket);
      return { hubWebhookId: null, hubWebhookToken: null };
    }
    await sendHubLog(client, {
      content: `Couldn't move <#${channel.id}> to the closed category, so it was deleted. Is the category full?`,
      allowedMentions: { parse: [] },
    });
  }

  const deleted = await deleteChannel(channel, DELETE_REASON);
  if (!deleted) {
    await sendHubLog(client, {
      content: `Couldn't delete the closed ticket channel <#${channel.id}>. Please delete it by hand.`,
      allowedMentions: { parse: [] },
    });
  }
  return emptySide('hub');
}

async function archiveHubChannel(channel: TextChannel, closedCategoryId: string): Promise<void> {
  await channel.edit({
    parent: closedCategoryId,
    lockPermissions: false,
    permissionOverwrites: readOnlyOverwrites(channel),
    reason: 'Ticket closed (archived)',
  });
}

/**
 * Denies writing on every existing overwrite, not just @everyone, because a
 * role overwrite that allows sending wins over an @everyone deny.
 */
function readOnlyOverwrites(channel: TextChannel): OverwriteData[] {
  const everyoneId = channel.guild.roles.everyone.id;
  const overwrites: OverwriteData[] = channel.permissionOverwrites.cache.map((overwrite) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: new PermissionsBitField(overwrite.allow).remove(WRITE_PERMISSIONS),
    deny: new PermissionsBitField(overwrite.deny).add(WRITE_PERMISSIONS),
  }));
  if (!overwrites.some((overwrite) => overwrite.id === everyoneId)) {
    overwrites.push({ id: everyoneId, type: OverwriteType.Role, deny: WRITE_PERMISSIONS });
  }
  return overwrites;
}

async function deleteHubWebhook(client: Client<true>, ticket: Ticket): Promise<void> {
  if (!ticket.hubWebhookId) return;
  try {
    await client.deleteWebhook(ticket.hubWebhookId, { reason: DELETE_REASON });
  } catch (error) {
    logger.debug(`Could not delete hub webhook of ticket ${ticket.id}`, error);
  }
}
