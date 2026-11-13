import {
  EmbedBuilder,
  Events,
  TimestampStyles,
  channelMention,
  time,
  userMention,
  type Client,
  type GuildMember,
  type Message,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { fetchHubGuild, isHubGuild, sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import { sendTempNotice } from '../core/notices.js';
import { truncate } from '../core/text.js';
import { getClientServer, isBlacklisted } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { uploadLimitBytes } from '../relay/uploads.js';
import { captureFiles } from './attachments.js';
import { createTicket } from './create.js';
import { getLastClosedAt, getOpenTicketsOfOpener } from './repo.js';
import { cooldownEndsAt } from './rules.js';

const SUBJECT_LIMIT = 4000;

/** Users whose ticket is being created right now, keyed by `<guildId>:<userId>`. */
const usersInProgress = new Set<string>();

export function registerIntake(client: Client): void {
  client.on(Events.MessageCreate, (message) => {
    handleIntakeMessage(message).catch((error: unknown) =>
      logger.error(`Intake failed for message ${message.id}`, error),
    );
  });
}

async function handleIntakeMessage(message: Message): Promise<void> {
  if (!message.inGuild() || isHubGuild(message.guildId)) return;
  if (message.author.bot || message.webhookId || message.system) return;
  const server = getClientServer(message.guildId);
  if (!server || server.intakeChannelId !== message.channelId) return;
  const member =
    message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return;

  const unavailable = unavailableNotice(server);
  if (unavailable) return reject(message, unavailable);

  const lockKey = `${message.guildId}:${message.author.id}`;
  if (usersInProgress.has(lockKey)) {
    return reject(
      message,
      `${userMention(message.author.id)}, your ticket is already being set up.`,
    );
  }
  usersInProgress.add(lockKey);
  try {
    const problem = validationProblem(message, server);
    if (problem) return await reject(message, problem);
    await openTicket(message, member, server);
  } finally {
    usersInProgress.delete(lockKey);
  }
}

function unavailableNotice(server: ClientServer): string | null {
  switch (server.status) {
    case 'active':
      return null;
    case 'pending':
      return 'Tickets are not open yet.';
    case 'paused':
      return server.pauseMessage ?? 'Tickets are paused right now. Please try again later.';
    case 'unlinked':
      return 'Support is unavailable right now.';
  }
}

function validationProblem(message: Message<true>, server: ClientServer): string | null {
  const user = userMention(message.author.id);
  if (isBlacklisted(message.author.id, server.guildId)) {
    return `${user}, you can't open tickets here.`;
  }
  const openTickets = getOpenTicketsOfOpener(server.guildId, message.author.id);
  if (openTickets.length >= server.maxOpenTickets) {
    const links = openTickets
      .flatMap((ticket) => (ticket.clientChannelId ? [channelMention(ticket.clientChannelId)] : []))
      .join(', ');
    return `${user}, you already have an open ticket: ${links || 'please wait for it to close'}.`;
  }
  if (message.content.trim().length < server.minSubjectLength) {
    return `${user}, please describe your problem in at least ${server.minSubjectLength} characters.`;
  }
  const cooldownEnd = cooldownEndsAt(
    getLastClosedAt(server.guildId, message.author.id),
    server.cooldownSeconds,
  );
  if (cooldownEnd) {
    return `${user}, you can open a new ticket ${time(cooldownEnd, TimestampStyles.RelativeTime)}.`;
  }
  return null;
}

async function openTicket(
  message: Message<true>,
  opener: GuildMember,
  server: ClientServer,
): Promise<void> {
  const client = message.client;
  const files = await captureFiles(
    [...message.attachments.values()],
    await largestUploadLimit(message),
  );
  await deleteQuietly(message);
  const notices = message.channel;
  try {
    const ticket = await createTicket(client, {
      server,
      opener,
      subject: truncate(message.content.trim(), SUBJECT_LIMIT),
      files,
    });
    await sendTempNotice(
      notices,
      `${userMention(opener.id)}, your ticket is open: ${channelMention(ticket.clientChannelId!)}`,
    );
  } catch (error) {
    logger.error(`Failed to open a ticket for ${opener.id} in ${server.guildId}`, error);
    await sendTempNotice(
      notices,
      `${userMention(opener.id)}, we couldn't open a ticket right now. Staff got a notification.`,
    );
    await alertHub(client, opener, error);
  }
}

/** Files above both servers' upload limits would only become links, so they are not downloaded. */
async function largestUploadLimit(message: Message<true>): Promise<number> {
  const hub = await fetchHubGuild(message.client).catch(() => null);
  return Math.max(
    uploadLimitBytes(message.guild.premiumTier),
    hub ? uploadLimitBytes(hub.premiumTier) : 0,
  );
}

async function reject(message: Message<true>, notice: string): Promise<void> {
  await deleteQuietly(message);
  await sendTempNotice(message.channel, notice);
}

async function deleteQuietly(message: Message<true>): Promise<void> {
  await message
    .delete()
    .catch((error: unknown) => logger.warn(`Failed to delete intake message ${message.id}`, error));
}

async function alertHub(client: Client<true>, opener: GuildMember, error: unknown): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  const embed = new EmbedBuilder()
    .setColor(Colors.error)
    .setTitle('Could not open a ticket')
    .setDescription(
      [
        `Server: ${opener.guild.name} (\`${opener.guild.id}\`)`,
        `User: ${opener.user.username} (\`${opener.id}\`)`,
        `Error: ${truncate(reason, 1000)}`,
      ].join('\n'),
    );
  await sendHubLog(client, { embeds: [embed], allowedMentions: { parse: [] } });
}
