import {
  ChannelType,
  Events,
  type Client,
  type DMChannel,
  type Guild,
  type NonThreadGuildBasedChannel,
  type Role,
} from 'discord.js';
import { config } from '../config.js';
import { isHubGuild, sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import {
  getClientServer,
  getHubConfig,
  updateClientServer,
  updateHubConfig,
} from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { sendClientLog } from './clientLog.js';
import { serverName } from './format.js';
import { deleteIntakePinNotice, refreshIntakeMessage } from './intakeMessage.js';
import { handleClientRemoved, pauseClient } from './linking.js';
import { findClientsByHubCategory, listLinkedClientServers, saveClientServer } from './repo.js';

async function onGuildDelete(guild: Guild): Promise<void> {
  if (isHubGuild(guild.id)) {
    logger.error('The bot was removed from the hub server');
    return;
  }
  await handleClientRemoved(guild.client, guild.id, guild.name);
}

function onGuildUpdate(before: Guild, after: Guild): void {
  if (before.name !== after.name) updateClientServer(after.id, { name: after.name });
}

async function onClientChannelDelete(channel: NonThreadGuildBasedChannel): Promise<void> {
  const server = getClientServer(channel.guildId);
  if (!server || server.status === 'unlinked') return;
  const what =
    channel.id === server.intakeChannelId
      ? 'intake channel'
      : channel.id === server.ticketCategoryId
        ? 'ticket category'
        : null;
  if (!what) return;

  await sendHubLog(
    channel.client,
    `⚠️ The ${what} of **${channel.guild.name}** (\`${channel.guildId}\`) was deleted. New tickets can’t be opened there until their admins run \`/setup\`.`,
  );
  await sendClientLog(
    channel.client,
    server,
    `⚠️ The ${what} was deleted, so new tickets can’t be opened. Run \`/setup\` to fix it.`,
  );
}

async function onHubCategoryDelete(channel: NonThreadGuildBasedChannel): Promise<void> {
  const affected = findClientsByHubCategory(channel.id);
  if (affected.length === 0) return;

  const client = channel.client;
  const paused: string[] = [];
  for (const server of affected) {
    if (server.status !== 'active') continue;
    try {
      await pauseClient(client, server.guildId, null);
      paused.push(serverName(client, server));
    } catch (error) {
      logger.error(`Failed to pause ${server.guildId} after its hub category was deleted`, error);
    }
  }
  const pausedText = paused.length > 0 ? ` I paused: ${paused.join(', ')}.` : '';
  await sendHubLog(
    client,
    `⚠️ The category **${channel.name}** was deleted.${pausedText} Use \`/clients set-category\`, then \`/clients resume\`.`,
  );
}

async function onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
  if (channel.isDMBased()) return;
  if (!isHubGuild(channel.guildId)) await onClientChannelDelete(channel);
  else if (channel.type === ChannelType.GuildCategory) await onHubCategoryDelete(channel);
}

function onRoleDelete(role: Role): void {
  if (isHubGuild(role.guild.id)) {
    const { staffRoleIds } = getHubConfig();
    if (staffRoleIds.includes(role.id)) {
      updateHubConfig({ staffRoleIds: staffRoleIds.filter((id) => id !== role.id) });
    }
    return;
  }
  const server = getClientServer(role.guild.id);
  if (server?.staffRoleIds.includes(role.id)) {
    saveClientServer(server.guildId, {
      staffRoleIds: server.staffRoleIds.filter((id) => id !== role.id),
    });
  }
}

/** Wraps a sync or async handler so a failure is logged instead of escaping the emitter. */
function safely<Args extends unknown[]>(event: string, handler: (...args: Args) => unknown) {
  return (...args: Args): void => {
    (async () => handler(...args))().catch((error: unknown) =>
      logger.error(`Setup ${event} handler failed`, error),
    );
  };
}

export function registerSetupEvents(client: Client): void {
  client.on(Events.GuildDelete, safely('GuildDelete', onGuildDelete));
  client.on(Events.GuildUpdate, safely('GuildUpdate', onGuildUpdate));
  client.on(Events.ChannelDelete, safely('ChannelDelete', onChannelDelete));
  client.on(Events.GuildRoleDelete, safely('GuildRoleDelete', onRoleDelete));
  client.on(Events.MessageCreate, safely('MessageCreate', deleteIntakePinNotice));
}

/**
 * Catches up on servers that removed the bot while it was offline, and brings
 * every intake message in line with the current status.
 */
export async function syncClientServersOnStartup(client: Client<true>): Promise<void> {
  // Without the hub the bot is likely misconfigured (wrong token or guild ID),
  // and unlinking every client would force-close all their tickets.
  const canDetectRemovals = client.guilds.cache.has(config.hubGuildId);

  for (const server of listLinkedClientServers()) {
    try {
      await syncClientServer(client, server, canDetectRemovals);
    } catch (error) {
      logger.error(`Startup sync of client server ${server.guildId} failed`, error);
    }
  }
}

async function syncClientServer(
  client: Client<true>,
  server: ClientServer,
  canDetectRemovals: boolean,
): Promise<void> {
  const guild = client.guilds.cache.get(server.guildId);
  if (!guild) {
    if (canDetectRemovals) await handleClientRemoved(client, server.guildId);
    return;
  }
  if (!guild.available) return;
  // Name changes made while the bot was offline never arrive as GuildUpdate.
  const current =
    guild.name === server.name ? server : saveClientServer(server.guildId, { name: guild.name });
  await refreshIntakeMessage(client, current);
}
