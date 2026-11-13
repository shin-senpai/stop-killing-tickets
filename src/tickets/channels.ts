import {
  ChannelType,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type MessageCreateOptions,
  type TextChannel,
} from 'discord.js';
import { isHubGuild } from '../core/hub.js';
import { logger } from '../core/logger.js';
import {
  botGuildPermissions,
  missingBotPermissions,
  TICKET_CATEGORY_PERMISSIONS,
} from '../core/permissions.js';
import { padTicketNumber } from '../core/text.js';
import type { Ticket, TicketSide } from '../db/schema.js';
import { isUnknownResourceError } from '../core/discordErrors.js';
import { fetchTicketChannel } from '../relay/channels.js';
import { createInCategory } from './categories.js';
import { existingRoleIds } from './permissions.js';
import { clientTicketOverwrites } from './ticketOverwrites.js';

interface ClientChannelInput {
  categoryId: string;
  name: string;
  opener: GuildMember;
  staffRoleIds: readonly string[];
  number: number;
}

export function createClientTicketChannel(input: ClientChannelInput): Promise<TextChannel> {
  const guild = input.opener.guild;
  return createInCategory(guild, input.categoryId, (parent) =>
    guild.channels.create({
      name: input.name,
      type: ChannelType.GuildText,
      parent,
      permissionOverwrites: clientTicketOverwrites({
        guildId: guild.id,
        botId: guild.client.user.id,
        botPermissions: botGuildPermissions(guild),
        openerId: input.opener.id,
        staffRoleIds: existingRoleIds(guild, input.staffRoleIds),
      }),
      reason: `Ticket #${padTicketNumber(input.number)}`,
    }),
  );
}

interface HubChannelInput {
  hubGuild: Guild;
  categoryId: string;
  name: string;
  topic: string;
}

export async function createHubTicketChannel(input: HubChannelInput): Promise<TextChannel> {
  const { hubGuild } = input;
  const channel = await createInCategory(hubGuild, input.categoryId, (parent) =>
    hubGuild.channels.create({
      name: input.name,
      type: ChannelType.GuildText,
      parent,
      topic: input.topic,
      // Copying the category's overwrites leaves the channel synced to the category.
      permissionOverwrites: parent.permissionOverwrites.cache,
      reason: `Ticket ${input.name}`,
    }),
  );
  const missing = missingBotPermissions(channel, TICKET_CATEGORY_PERMISSIONS);
  if (missing.length > 0) {
    await channel.delete().catch(() => undefined);
    throw new Error(
      `The bot is missing ${missing.join(', ')} in the hub category of ${input.name}`,
    );
  }
  return channel;
}

/** Returns null when the channel is gone. Never contacts a client server the bot has left. */
export async function fetchSideChannel(
  client: Client<true>,
  ticket: Ticket,
  side: TicketSide,
): Promise<TextChannel | null> {
  if (side === 'client') {
    if (!client.guilds.cache.has(ticket.clientGuildId)) return null;
    return fetchTicketChannel(client, ticket.clientChannelId);
  }
  const channel = await fetchTicketChannel(client, ticket.hubChannelId);
  return channel && isHubGuild(channel.guildId) ? channel : null;
}

export async function sendToTicketChannel(
  client: Client<true>,
  ticket: Ticket,
  side: TicketSide,
  payload: MessageCreateOptions,
): Promise<Message | undefined> {
  const channel = await fetchSideChannel(client, ticket, side);
  if (!channel) return undefined;
  try {
    return await channel.send({ allowedMentions: { parse: [] }, ...payload });
  } catch (error) {
    logger.warn(`Could not send to ticket channel ${channel.id}`, error);
    return undefined;
  }
}

/** Returns true when the channel is gone, including when it was already deleted. */
export async function deleteChannel(channel: TextChannel, reason: string): Promise<boolean> {
  try {
    await channel.delete(reason);
    return true;
  } catch (error) {
    if (isUnknownResourceError(error)) return true;
    logger.warn(`Could not delete channel ${channel.id}`, error);
    return false;
  }
}

/** Logs a failed step instead of throwing, so one missing channel does not stop the others. */
export async function runStep(description: string, task: () => Promise<unknown>): Promise<boolean> {
  try {
    await task();
    return true;
  } catch (error) {
    logger.warn(`Ticket step failed: ${description}`, error);
    return false;
  }
}
