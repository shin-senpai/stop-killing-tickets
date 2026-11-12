import { ChannelType, type Client, type TextChannel } from 'discord.js';
import { logger } from '../core/logger.js';
import { isUnknownResourceError } from '../core/discordErrors.js';

/** The ticket channel, or null when it is gone or not a text channel. */
export async function fetchTicketChannel(
  client: Client<true>,
  channelId: string | null,
): Promise<TextChannel | null> {
  if (!channelId) return null;
  try {
    const channel = await client.channels.fetch(channelId);
    return channel?.type === ChannelType.GuildText ? channel : null;
  } catch (error) {
    if (!isUnknownResourceError(error)) logger.warn(`Failed to fetch channel ${channelId}`, error);
    return null;
  }
}
