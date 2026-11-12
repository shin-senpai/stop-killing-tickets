import type { Client, MessageCreateOptions } from 'discord.js';
import { logger } from '../core/logger.js';
import type { ClientServer } from '../db/schema.js';

/** Posts to the client server's log channel, if one is set. Never throws. */
export async function sendClientLog(
  client: Client<true>,
  server: ClientServer,
  content: string,
): Promise<void> {
  if (!server.logChannelId) return;
  const payload: MessageCreateOptions = { content, allowedMentions: { parse: [] } };
  try {
    const channel = await client.channels.fetch(server.logChannelId);
    if (channel?.isSendable()) await channel.send(payload);
  } catch (error) {
    logger.warn(`Failed to post to the log channel of ${server.guildId}`, error);
  }
}
