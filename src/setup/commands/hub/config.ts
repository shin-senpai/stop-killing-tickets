import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  type CategoryChannel,
  type Guild,
} from 'discord.js';
import { Colors } from '../../../core/colors.js';
import { UserFacingError } from '../../../core/errors.js';
import { getHubConfig, updateHubConfig } from '../../../db/queries.js';
import type { HubConfig } from '../../../db/schema.js';
import { withChannelPermissionHint } from '../../channelErrors.js';
import { createStaffCategory, findCategory } from '../../channels.js';
import { channelText, joinLines, roleListText } from '../../format.js';
import { missingPermissionLine } from '../../permissionReport.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

const STAFF_IDENTITIES: readonly HubConfig['staffIdentity'][] = ['named', 'anonymous', 'role'];

function autoCloseText(hub: HubConfig): string {
  if (hub.autoCloseWarnHours === null || hub.autoCloseCloseHours === null) return 'off';
  return `ask after ${hub.autoCloseWarnHours}h, close ${hub.autoCloseCloseHours}h later`;
}

function archiveText(hub: HubConfig): string {
  if (hub.archiveMode === 'delete') return 'delete channels';
  return `move to ${channelText(hub.closedCategoryId)}`;
}

function buildHubConfigEmbed(hub: HubConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle('Hub settings')
    .addFields(
      { name: 'Log channel', value: channelText(hub.logChannelId), inline: true },
      { name: 'Transcripts', value: channelText(hub.transcriptChannelId), inline: true },
      { name: 'Staff roles', value: roleListText(hub.staffRoleIds), inline: true },
      { name: 'Staff identity', value: hub.staffIdentity, inline: true },
      { name: 'Note prefix', value: `\`${hub.notePrefix}\``, inline: true },
      { name: 'Grace period', value: `${hub.graceMinutes} min`, inline: true },
      { name: 'Auto-close', value: autoCloseText(hub) },
      { name: 'After closing', value: archiveText(hub) },
    );
}

export async function viewHubConfig(interaction: CommandInteraction): Promise<void> {
  await replyPrivately(interaction, '', [buildHubConfigEmbed(getHubConfig())]);
}

export async function setStaffIdentity(interaction: CommandInteraction): Promise<void> {
  const mode = interaction.options.getString('mode', true);
  const staffIdentity = STAFF_IDENTITIES.find((identity) => identity === mode);
  if (!staffIdentity) throw new UserFacingError('Pick one of the listed modes.');
  updateHubConfig({ staffIdentity });
  await replyPrivately(interaction, `Staff identity set to **${staffIdentity}**.`);
}

export async function setNotePrefix(interaction: CommandInteraction): Promise<void> {
  const notePrefix = interaction.options.getString('prefix', true).trim();
  if (notePrefix === '') throw new UserFacingError('The prefix can’t be empty.');
  updateHubConfig({ notePrefix });
  await replyPrivately(interaction, `Messages starting with \`${notePrefix}\` now stay internal.`);
}

export async function setAutoClose(interaction: CommandInteraction): Promise<void> {
  const autoCloseWarnHours = interaction.options.getInteger('warn-hours', true);
  const autoCloseCloseHours = interaction.options.getInteger('close-hours', true);
  updateHubConfig({ autoCloseWarnHours, autoCloseCloseHours });
  await replyPrivately(
    interaction,
    `Auto-close is on: I ask the user after ${autoCloseWarnHours}h without a reply and close the ticket ${autoCloseCloseHours}h later.`,
  );
}

export async function disableAutoClose(interaction: CommandInteraction): Promise<void> {
  updateHubConfig({ autoCloseWarnHours: null, autoCloseCloseHours: null });
  await replyPrivately(interaction, 'Auto-close is off.');
}

function closedCategoryFor(
  guild: Guild,
  chosen: CategoryChannel | null,
  hub: HubConfig,
): Promise<CategoryChannel> {
  const existing = chosen ?? findCategory(guild, hub.closedCategoryId);
  if (existing) return Promise.resolve(existing);
  return withChannelPermissionHint(
    () => createStaffCategory(guild, 'Closed Tickets'),
    'I couldn’t create a category for closed tickets.',
  );
}

export async function setArchiveMode(interaction: CommandInteraction): Promise<void> {
  const { guild, options } = interaction;
  if (options.getString('mode', true) === 'delete') {
    updateHubConfig({ archiveMode: 'delete' });
    await replyPrivately(interaction, 'Hub channels are deleted after a ticket closes.');
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const chosen = options.getChannel('closed-category', false, [ChannelType.GuildCategory]);
  const category = await closedCategoryFor(guild, chosen, getHubConfig());
  updateHubConfig({ archiveMode: 'move', closedCategoryId: category.id });
  await replyPrivately(
    interaction,
    joinLines(
      `Closed tickets are moved to ${category}. Its channels count toward the 500-channel limit.`,
      missingPermissionLine(category),
    ),
  );
}

export async function setGracePeriod(interaction: CommandInteraction): Promise<void> {
  const graceMinutes = interaction.options.getInteger('minutes', true);
  updateHubConfig({ graceMinutes });
  await replyPrivately(
    interaction,
    graceMinutes === 0
      ? 'Closed tickets are removed right away and can’t be reopened.'
      : `Closed tickets can be reopened for ${graceMinutes} minutes.`,
  );
}
