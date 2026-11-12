import { EmbedBuilder, MessageType, type Client, type Message } from 'discord.js';
import { Colors } from '../core/colors.js';
import { logger } from '../core/logger.js';
import { updateClientServer } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { findTextChannel } from './channels.js';
import { isIntakeChannel } from './repo.js';

export const INTAKE_TEXT_LIMIT = 4000;

const TITLE = '🎫 Support tickets';
const DEFAULT_PAUSE_MESSAGE = 'Tickets are paused for now. Please check back later.';

export function defaultIntakeText(server: ClientServer): string {
  return [
    '**Need help?** Type your question in this channel and send it.',
    'Your message becomes a private ticket that only you and the support team can see.',
    `Please write at least ${server.minSubjectLength} characters so we know what it’s about.`,
  ].join('\n\n');
}

export function buildIntakeEmbed(server: ClientServer): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(TITLE);
  switch (server.status) {
    case 'pending':
      return embed
        .setColor(Colors.closing)
        .setDescription(
          'Tickets aren’t open yet. This server is still being connected to the support team.',
        );
    case 'active':
      return embed
        .setColor(Colors.open)
        .setDescription(server.intakeText ?? defaultIntakeText(server));
    case 'paused':
      return embed
        .setColor(Colors.closing)
        .setDescription(server.pauseMessage ?? DEFAULT_PAUSE_MESSAGE);
    case 'unlinked':
      return embed.setColor(Colors.closed).setDescription('Support is unavailable here right now.');
  }
}

/**
 * Edits the pinned intake message to match the server's status, or posts and
 * pins a new one if it is missing. Returns false if the bot could not post.
 */
export async function refreshIntakeMessage(
  client: Client<true>,
  server: ClientServer,
): Promise<boolean> {
  const guild = client.guilds.cache.get(server.guildId);
  const channel = guild && findTextChannel(guild, server.intakeChannelId);
  if (!channel) return false;

  const payload = { embeds: [buildIntakeEmbed(server)], allowedMentions: { parse: [] } };
  try {
    const existing = server.intakeMessageId
      ? await channel.messages.fetch(server.intakeMessageId).catch(() => null)
      : null;
    if (existing) {
      await existing.edit(payload);
      return true;
    }
    const message = await channel.send(payload);
    updateClientServer(server.guildId, { intakeMessageId: message.id });
    await message.pin().catch((error) => logger.warn('Failed to pin intake message', error));
    return true;
  } catch (error) {
    logger.warn(`Failed to refresh the intake message in ${server.guildId}`, error);
    return false;
  }
}

export async function deleteIntakeMessage(
  client: Client<true>,
  server: ClientServer,
): Promise<void> {
  if (!server.intakeChannelId || !server.intakeMessageId) return;
  try {
    const channel = await client.channels.fetch(server.intakeChannelId);
    if (!channel?.isTextBased()) return;
    await channel.messages.delete(server.intakeMessageId);
  } catch {
    // The old channel or message is already gone, which is fine.
  }
}

/** Removes the "pinned a message" notice Discord posts when the bot pins the intake embed. */
export async function deleteIntakePinNotice(message: Message): Promise<void> {
  if (message.type !== MessageType.ChannelPinnedMessage) return;
  if (message.author.id !== message.client.user.id) return;
  if (!isIntakeChannel(message.channelId)) return;
  await message.delete().catch(() => undefined);
}
