import {
  EmbedBuilder,
  MessageFlags,
  type CategoryChannel,
  type Client,
  type Guild,
} from 'discord.js';
import { Colors } from '../../../core/colors.js';
import {
  CATEGORY_CHANNEL_LIMIT,
  CATEGORY_WARNING_COUNT,
  EMBED_DESCRIPTION_LIMIT,
  GUILD_CHANNEL_LIMIT,
  GUILD_CHANNEL_WARNING_COUNT,
} from '../../../core/limits.js';
import { truncate } from '../../../core/text.js';
import { getHubConfig, updateHubConfig } from '../../../db/queries.js';
import type { ClientServer, HubConfig } from '../../../db/schema.js';
import {
  childChannelCount,
  findCategory,
  findTextChannel,
  LOG_CHANNEL_PERMISSIONS,
} from '../../channels.js';
import { serverName } from '../../format.js';
import { missingPermissionLine, missingServerPermissionLine } from '../../permissionReport.js';
import { listLinkedClientServers } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

function checkStaffChannel(guild: Guild, label: string, channelId: string | null): string {
  if (!channelId) return `❌ No ${label} is set. Set one with \`/hub setup\`.`;
  const channel = findTextChannel(guild, channelId);
  if (!channel) return `❌ The ${label} is missing. Set one with \`/hub setup\`.`;
  return (
    missingPermissionLine(channel, LOG_CHANNEL_PERMISSIONS) ??
    `✅ I can post in the ${label} ${channel}.`
  );
}

function checkCategoryCapacity(category: CategoryChannel, usedBy: string): string[] {
  const count = childChannelCount(category);
  const icon = count >= CATEGORY_WARNING_COUNT ? '⚠️' : '✅';
  return [
    `${icon} ${category} (${usedBy}) has ${count}/${CATEGORY_CHANNEL_LIMIT} channels.`,
    ...[missingPermissionLine(category)].filter((line): line is string => line !== null),
  ];
}

/** Several clients can share one hub category, so each category is checked once. */
function checkClientCategories(client: Client<true>, guild: Guild, clients: ClientServer[]) {
  const results: string[] = [];
  const clientsByCategory = new Map<string, ClientServer[]>();
  for (const server of clients) {
    if (server.status === 'pending') continue;
    if (!server.hubCategoryId) {
      results.push(
        `❌ ${serverName(client, server)} has no hub category. Use \`/clients set-category\`.`,
      );
      continue;
    }
    clientsByCategory.set(server.hubCategoryId, [
      ...(clientsByCategory.get(server.hubCategoryId) ?? []),
      server,
    ]);
  }
  for (const [categoryId, servers] of clientsByCategory) {
    const names = servers.map((server) => serverName(client, server)).join(', ');
    const category = findCategory(guild, categoryId);
    if (!category) {
      results.push(`❌ The hub category of ${names} is missing. Use \`/clients set-category\`.`);
      continue;
    }
    results.push(...checkCategoryCapacity(category, names));
  }
  return results;
}

function checkArchiveCategory(guild: Guild, hub: HubConfig): string[] {
  if (hub.archiveMode !== 'move') return [];
  const category = findCategory(guild, hub.closedCategoryId);
  if (!category) {
    return [
      '❌ The archive category is missing. Closed hub channels are deleted instead. Use `/hub config archive-mode`.',
    ];
  }
  return checkCategoryCapacity(category, 'archive');
}

function checkChannelCount(guild: Guild): string {
  const count = guild.channels.cache.filter((channel) => !channel.isThread()).size;
  const icon = count >= GUILD_CHANNEL_WARNING_COUNT ? '⚠️' : '✅';
  return `${icon} This server has ${count}/${GUILD_CHANNEL_LIMIT} channels.`;
}

function checkStaffRoles(guild: Guild, hub: HubConfig): string {
  if (hub.staffRoleIds.length === 0) {
    return 'ℹ️ No hub staff roles are set, so anyone who can see a ticket channel counts as staff.';
  }
  const existing = hub.staffRoleIds.filter((id) => guild.roles.cache.has(id));
  if (existing.length === hub.staffRoleIds.length) return '✅ All hub staff roles exist.';
  updateHubConfig({ staffRoleIds: existing });
  return 'ℹ️ Some hub staff roles were deleted, so I removed them from the list.';
}

function summarizeClients(clients: ClientServer[]): string {
  const count = (status: ClientServer['status']) =>
    clients.filter((server) => server.status === status).length;
  const pending = count('pending');
  const line = `ℹ️ Client servers: ${count('active')} active, ${count('paused')} paused, ${pending} pending.`;
  return pending > 0
    ? `${line} Approve or reject pending servers in the hub log or with \`/clients\`.`
    : line;
}

export async function runHubHealthCheck(interaction: CommandInteraction): Promise<void> {
  const { guild, client } = interaction;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const hub = getHubConfig();
  const clients = listLinkedClientServers();

  const results = [
    missingServerPermissionLine(guild.members.me) ?? '✅ My role has every permission I need.',
    checkStaffChannel(guild, 'log channel', hub.logChannelId),
    checkStaffChannel(guild, 'transcript channel', hub.transcriptChannelId),
    ...checkClientCategories(client, guild, clients),
    ...checkArchiveCategory(guild, hub),
    checkChannelCount(guild),
    checkStaffRoles(guild, hub),
    summarizeClients(clients),
  ];
  const hasProblems = results.some((line) => line.startsWith('❌') || line.startsWith('⚠️'));
  const embed = new EmbedBuilder()
    .setTitle('Hub health check')
    .setColor(hasProblems ? Colors.closing : Colors.open)
    .setDescription(truncate(results.join('\n'), EMBED_DESCRIPTION_LIMIT));
  await replyPrivately(interaction, '', [embed]);
}
