import type { Client, User } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import { toChannelSlug } from '../core/text.js';
import { getClientServer } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { forceCloseClientTickets } from '../tickets/lifecycle.js';
import { sendClientLog } from './clientLog.js';
import { refreshIntakeMessage } from './intakeMessage.js';
import { resolveLinkRequest } from './linkRequest.js';
import { isTagTaken, saveClientServer } from './repo.js';

export const TAG_MAX_LENGTH = 16;
const TAG_PATTERN = new RegExp(`^[a-z0-9-]{2,${TAG_MAX_LENGTH}}$`);

export function validateTag(input: string, guildId: string): string {
  const tag = input.trim().toLowerCase();
  if (!TAG_PATTERN.test(tag)) {
    throw new UserFacingError(
      `A tag must be 2–${TAG_MAX_LENGTH} characters: lowercase letters, numbers or \`-\`.`,
    );
  }
  if (isTagTaken(tag, guildId)) throw new UserFacingError(`The tag \`${tag}\` is already in use.`);
  return tag;
}

export function suggestTag(name: string): string {
  const slug = toChannelSlug(name, TAG_MAX_LENGTH);
  return slug.length >= 2 ? slug : 'client';
}

function requireServer(guildId: string): ClientServer {
  const server = getClientServer(guildId);
  if (!server) throw new UserFacingError('That server isn’t registered.');
  return server;
}

interface Approval {
  tag: string;
  hubCategoryId: string;
  approvedBy: User;
}

// Each transition below reads the current row and writes the new status with no
// await in between, so two admins acting at once cannot both pass the status check.

export async function approveClient(
  client: Client<true>,
  guildId: string,
  { tag, hubCategoryId, approvedBy }: Approval,
): Promise<ClientServer> {
  const server = requireServer(guildId);
  if (server.status !== 'pending') {
    throw new UserFacingError('Only servers waiting for approval can be approved.');
  }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new UserFacingError('I’m no longer in that server, so it can’t be approved.');
  const approved = saveClientServer(guildId, {
    status: 'active',
    name: guild.name,
    tag: validateTag(tag, guildId),
    hubCategoryId,
    approvedBy: approvedBy.id,
    approvedAt: new Date(),
    pauseMessage: null,
  });
  await resolveLinkRequest(
    client,
    approved,
    `Approved by ${approvedBy} · tag \`${approved.tag}\` · <#${hubCategoryId}>`,
    true,
  );
  await refreshIntakeMessage(client, approved);
  await sendClientLog(client, approved, '✅ This server is now connected. Tickets are open.');
  return approved;
}

export async function rejectClient(
  client: Client<true>,
  guildId: string,
  rejectedBy: User,
): Promise<ClientServer> {
  const server = requireServer(guildId);
  if (server.status !== 'pending') {
    throw new UserFacingError('Only servers waiting for approval can be rejected.');
  }
  const rejected = saveClientServer(guildId, { status: 'unlinked' });
  await resolveLinkRequest(client, rejected, `Rejected by ${rejectedBy}`, false);
  await refreshIntakeMessage(client, rejected);
  await sendClientLog(client, rejected, 'The support team declined the connection request.');
  return rejected;
}

export async function pauseClient(
  client: Client<true>,
  guildId: string,
  pauseMessage: string | null,
): Promise<ClientServer> {
  const server = requireServer(guildId);
  if (server.status !== 'active' && server.status !== 'paused') {
    throw new UserFacingError('Only connected servers can be paused.');
  }
  const paused = saveClientServer(guildId, { status: 'paused', pauseMessage });
  await refreshIntakeMessage(client, paused);
  await sendClientLog(client, paused, '⏸️ New tickets are paused by the support team.');
  return paused;
}

export async function resumeClient(client: Client<true>, guildId: string): Promise<ClientServer> {
  const server = requireServer(guildId);
  if (server.status !== 'paused') throw new UserFacingError('That server isn’t paused.');
  const resumed = saveClientServer(guildId, { status: 'active', pauseMessage: null });
  await refreshIntakeMessage(client, resumed);
  await sendClientLog(client, resumed, '▶️ Tickets are open again.');
  return resumed;
}

export async function unlinkClient(
  client: Client<true>,
  guildId: string,
  reason: string,
): Promise<ClientServer> {
  const server = requireServer(guildId);
  if (server.status === 'unlinked')
    throw new UserFacingError('That server isn’t connected anymore.');
  const unlinked = await markUnlinked(client, server, {}, 'Unlinked by the support team');
  await closeAllTickets(client, unlinked, reason);
  await refreshIntakeMessage(client, unlinked);
  await sendClientLog(client, unlinked, 'This server was disconnected from the support team.');
  return unlinked;
}

/** The bot left or was removed from a client server. */
export async function handleClientRemoved(
  client: Client<true>,
  guildId: string,
  guildName?: string,
): Promise<void> {
  const server = getClientServer(guildId);
  if (!server || server.status === 'unlinked') return;
  const unlinked = await markUnlinked(
    client,
    server,
    { name: guildName ?? server.name },
    'The bot was removed from the server',
  );
  await closeAllTickets(client, unlinked, 'The bot was removed from the server');
  await sendHubLog(
    client,
    `⚠️ I was removed from **${unlinked.name ?? 'a server'}** (\`${guildId}\`). It is now unlinked and its tickets were closed.`,
  );
}

async function markUnlinked(
  client: Client<true>,
  server: ClientServer,
  values: Partial<ClientServer>,
  linkRequestOutcome: string,
): Promise<ClientServer> {
  const unlinked = saveClientServer(server.guildId, { ...values, status: 'unlinked' });
  if (server.status === 'pending') {
    await resolveLinkRequest(client, unlinked, linkRequestOutcome, false);
  }
  return unlinked;
}

async function closeAllTickets(client: Client<true>, server: ClientServer, reason: string) {
  try {
    await forceCloseClientTickets(client, server.guildId, reason);
  } catch (error) {
    logger.error(`Failed to close the tickets of ${server.guildId}`, error);
    await sendHubLog(
      client,
      `⚠️ Couldn’t close all tickets of \`${server.guildId}\`. Check its hub channels.`,
    );
  }
}
