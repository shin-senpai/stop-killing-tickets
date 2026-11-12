import type { Client, Guild, MessageCreateOptions } from 'discord.js';
import { config } from '../config.js';
import { getHubConfig } from '../db/queries.js';
import { logger } from './logger.js';

export function isHubGuild(guildId: string | null | undefined): boolean {
  return guildId === config.hubGuildId;
}

export function fetchHubGuild(client: Client<true>): Promise<Guild> {
  return client.guilds.fetch(config.hubGuildId);
}

/**
 * Posts to the hub log channel. Does nothing if no log channel is set. Never throws.
 * Mentions do not ping unless the payload sets `allowedMentions` itself.
 */
export async function sendHubLog(client: Client<true>, payload: MessageCreateOptions | string) {
  const { logChannelId } = getHubConfig();
  if (!logChannelId) return undefined;
  const options = typeof payload === 'string' ? { content: payload } : payload;
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel?.isSendable()) {
      logger.warn(`Hub log channel ${logChannelId} is missing or not sendable`);
      return undefined;
    }
    return await channel.send({ allowedMentions: { parse: [] }, ...options });
  } catch (error) {
    logger.error('Failed to send hub log message', error);
    return undefined;
  }
}
