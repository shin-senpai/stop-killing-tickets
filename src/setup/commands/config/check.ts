import { EmbedBuilder, MessageFlags, type Guild, type TextChannel } from 'discord.js';
import { Colors } from '../../../core/colors.js';
import { CATEGORY_CHANNEL_LIMIT } from '../../../core/limits.js';
import type { ClientServer } from '../../../db/schema.js';
import {
  childChannelCount,
  findCategory,
  findTextChannel,
  INTAKE_CHANNEL_PERMISSIONS,
  LOG_CHANNEL_PERMISSIONS,
} from '../../channels.js';
import { statusLabel } from '../../format.js';
import { requireClientServer } from '../../guards.js';
import { missingGuildPermissionLine, missingPermissionLine } from '../../permissionReport.js';
import { saveClientServer } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

const CATEGORY_WARNING_THRESHOLD = 45;

function checkCategory(guild: Guild, server: ClientServer): string[] {
  const category = findCategory(guild, server.ticketCategoryId);
  if (!category) return ['❌ The ticket category is missing. Set one with `/config category`.'];
  const count = childChannelCount(category);
  const icon = count >= CATEGORY_WARNING_THRESHOLD ? '⚠️' : '✅';
  return [
    `${icon} ${category} has ${count}/${CATEGORY_CHANNEL_LIMIT} channels.`,
    missingPermissionLine(category) ?? `✅ I have everything I need in ${category}.`,
  ];
}

async function intakeMessageExists(channel: TextChannel, messageId: string | null) {
  if (!messageId) return false;
  return (await channel.messages.fetch(messageId).catch(() => null)) !== null;
}

async function checkIntake(guild: Guild, server: ClientServer): Promise<string[]> {
  const channel = findTextChannel(guild, server.intakeChannelId);
  if (!channel) return ['❌ The intake channel is missing. Set one with `/config intake-channel`.'];
  const results = [
    missingPermissionLine(channel, INTAKE_CHANNEL_PERMISSIONS) ??
      `✅ I have everything I need in ${channel}.`,
  ];
  if (!(await intakeMessageExists(channel, server.intakeMessageId))) {
    results.push(
      `⚠️ The instructions in ${channel} are missing. Run \`/setup\` to post them again.`,
    );
  }
  return results;
}

function checkLogChannel(guild: Guild, server: ClientServer): string[] {
  if (!server.logChannelId) return ['ℹ️ No log channel is set.'];
  const channel = findTextChannel(guild, server.logChannelId);
  if (!channel) return ['❌ The log channel is missing. Set one with `/config log-channel`.'];
  return [
    missingPermissionLine(channel, LOG_CHANNEL_PERMISSIONS) ??
      `✅ I can post in the log channel ${channel}.`,
  ];
}

function checkStaffRoles(guild: Guild, server: ClientServer): string[] {
  if (server.staffRoleIds.length === 0) {
    return ['ℹ️ No staff roles are set, so only admins can see tickets.'];
  }
  const existing = server.staffRoleIds.filter((id) => guild.roles.cache.has(id));
  if (existing.length === server.staffRoleIds.length) return ['✅ All staff roles exist.'];
  saveClientServer(server.guildId, { staffRoleIds: existing });
  return ['ℹ️ Some staff roles were deleted, so I removed them from the list.'];
}

export async function runHealthCheck(interaction: CommandInteraction): Promise<void> {
  const { guild } = interaction;
  const server = requireClientServer(guild.id);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const results = [
    `Status: ${statusLabel(server.status)}`,
    missingGuildPermissionLine(guild.members.me) ?? '✅ My role has every permission I need.',
    ...checkCategory(guild, server),
    ...(await checkIntake(guild, server)),
    ...checkLogChannel(guild, server),
    ...checkStaffRoles(guild, server),
  ];
  const hasProblems = results.some((line) => line.startsWith('❌') || line.startsWith('⚠️'));
  const embed = new EmbedBuilder()
    .setTitle('Health check')
    .setColor(hasProblems ? Colors.closing : Colors.open)
    .setDescription(results.join('\n'));
  await replyPrivately(interaction, '', [embed]);
}
