import {
  MessageType,
  SnowflakeUtil,
  type Client,
  type Message,
  type TextChannel,
} from 'discord.js';
import { logger } from '../core/logger.js';
import { getClientServer, getParticipantIds, getTicket } from '../db/queries.js';
import type { Ticket } from '../db/schema.js';
import { uploadLimitBytes } from '../relay/uploads.js';
import { isUnknownResourceError } from '../core/discordErrors.js';
import { fetchTicketChannel } from '../relay/channels.js';
import { openingFilesMessage, type CapturedFile } from './openingFiles.js';
import { getOpenerHistory } from './repo.js';
import { resolveStaffLabel } from '../core/staffIdentity.js';
import {
  renderClientStarter,
  renderHubStarter,
  type StarterContext,
  type StarterMessage,
} from './starterView.js';

export interface TicketChannels {
  client: TextChannel;
  hub: TextChannel;
}

export interface PostedStarter {
  starterMessageId: string;
  /** The last message the bot posted, where relay catch-up starts after a restart. */
  lastMessageId: string;
}

/** Each starter is pinned and followed by the opening files. */
export async function postStarterMessages(
  client: Client<true>,
  ticket: Ticket,
  channels: TicketChannels,
  files: readonly CapturedFile[],
): Promise<{ client: PostedStarter; hub: PostedStarter }> {
  const context = await loadStarterContext(client, ticket);
  const [clientStarter, hubStarter] = await Promise.all([
    postStarter(channels.client, renderClientStarter(context), files),
    postStarter(channels.hub, renderHubStarter(context), files),
  ]);
  return { client: clientStarter, hub: hubStarter };
}

/** Re-renders both starters from the database. Missing channels or messages are ignored. */
export async function refreshStarterMessages(client: Client<true>, ticket: Ticket): Promise<void> {
  const current = getTicket(ticket.id) ?? ticket;
  try {
    const context = await loadStarterContext(client, current);
    await Promise.all([
      editStarter(client, current.clientChannelId, current.clientStarterMessageId, () =>
        renderClientStarter(context),
      ),
      editStarter(client, current.hubChannelId, current.hubStarterMessageId, () =>
        renderHubStarter(context),
      ),
    ]);
  } catch (error) {
    logger.warn(`Failed to refresh starter messages of ticket ${current.id}`, error);
  }
}

async function loadStarterContext(client: Client<true>, ticket: Ticket): Promise<StarterContext> {
  const server = getClientServer(ticket.clientGuildId);
  const guild = client.guilds.cache.get(ticket.clientGuildId);
  const [user, member, helperLabel] = await Promise.all([
    client.users.fetch(ticket.openerId).catch(() => null),
    guild?.members.fetch(ticket.openerId).catch(() => null),
    ticket.claimedBy ? resolveStaffLabel(client, ticket.claimedBy) : null,
  ]);
  return {
    ticket,
    tag: server?.tag ?? 'ticket',
    serverName: guild?.name ?? server?.name ?? 'Unknown server',
    serverIconUrl: guild?.iconURL() ?? null,
    opener: {
      id: ticket.openerId,
      username: user?.username ?? 'unknown user',
      createdAt: new Date(SnowflakeUtil.timestampFrom(ticket.openerId)),
      joinedAt: member?.joinedAt ?? null,
    },
    history: getOpenerHistory(ticket),
    participantIds: getParticipantIds(ticket.id),
    helperLabel,
  };
}

async function postStarter(
  channel: TextChannel,
  starter: StarterMessage,
  files: readonly CapturedFile[],
): Promise<PostedStarter> {
  const message = await channel.send({ ...starter, allowedMentions: { parse: [] } });
  await pinWithoutNotice(message);
  const filesMessage = openingFilesMessage(files, uploadLimitBytes(channel.guild.premiumTier));
  const sentFiles = filesMessage
    ? await channel.send(filesMessage).catch((error: unknown) => {
        logger.warn(`Failed to post opening files in ${channel.id}`, error);
        return null;
      })
    : null;
  return { starterMessageId: message.id, lastMessageId: sentFiles?.id ?? message.id };
}

async function pinWithoutNotice(message: Message<true>): Promise<void> {
  try {
    await message.pin();
    // Pinning makes Discord post a "pinned a message" system message, which only adds noise here.
    const recent = await message.channel.messages.fetch({ limit: 5 });
    const notice = recent.find(
      (m) => m.type === MessageType.ChannelPinnedMessage && m.reference?.messageId === message.id,
    );
    await notice?.delete();
  } catch (error) {
    logger.warn(`Failed to pin starter message in ${message.channelId}`, error);
  }
}

async function editStarter(
  client: Client<true>,
  channelId: string | null,
  messageId: string | null,
  render: () => StarterMessage,
): Promise<void> {
  if (!messageId) return;
  const channel = await fetchTicketChannel(client, channelId);
  if (!channel) return;
  try {
    await channel.messages.edit(messageId, render());
  } catch (error) {
    if (!isUnknownResourceError(error)) {
      logger.warn(`Failed to edit starter message ${messageId}`, error);
    }
  }
}
