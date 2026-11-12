import type { SendableChannels } from 'discord.js';
import { logger } from './logger.js';

const DEFAULT_LIFETIME_MS = 10_000;

/**
 * Sends a message that deletes itself. Used where an ephemeral reply is not
 * possible, such as a reply to a normal message in the intake channel.
 */
export async function sendTempNotice(
  channel: SendableChannels,
  content: string,
  lifetimeMs = DEFAULT_LIFETIME_MS,
): Promise<void> {
  try {
    const message = await channel.send({ content, allowedMentions: { parse: ['users'] } });
    setTimeout(() => message.delete().catch(() => undefined), lifetimeMs).unref();
  } catch (error) {
    logger.warn('Failed to send temporary notice', error);
  }
}
