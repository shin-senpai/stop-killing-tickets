import { ChannelType, MessageFlags } from 'discord.js';
import { UserFacingError } from '../../../core/errors.js';
import { findCategory } from '../../channels.js';
import { joinLines, serverName } from '../../format.js';
import { resolveClientServer } from '../../guards.js';
import {
  approveClient,
  pauseClient,
  rejectClient,
  resumeClient,
  validateTag,
} from '../../linking.js';
import { missingPermissionLine } from '../../permissionReport.js';
import { saveClientServer } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';
import { SERVER_OPTION } from './definition.js';

function chosenServer(interaction: CommandInteraction) {
  return resolveClientServer(interaction.options.getString(SERVER_OPTION, true));
}

function chosenCategory(interaction: CommandInteraction) {
  return interaction.options.getChannel('category', true, [ChannelType.GuildCategory]);
}

export async function approve(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  const tag = validateTag(interaction.options.getString('tag', true), server.guildId);
  const category = chosenCategory(interaction);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await approveClient(interaction.client, server.guildId, {
    tag,
    hubCategoryId: category.id,
    approvedBy: interaction.user,
  });
  await replyPrivately(
    interaction,
    joinLines(
      `Approved **${serverName(interaction.client, server)}** as \`${tag}\`.`,
      missingPermissionLine(category),
    ),
  );
}

export async function reject(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await rejectClient(interaction.client, server.guildId, interaction.user);
  await replyPrivately(interaction, `Rejected **${serverName(interaction.client, server)}**.`);
}

export async function setCategory(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  const category = chosenCategory(interaction);
  saveClientServer(server.guildId, { hubCategoryId: category.id });
  await replyPrivately(
    interaction,
    joinLines(
      `New tickets from **${serverName(interaction.client, server)}** go to ${category}. Open tickets stay where they are.`,
      missingPermissionLine(category),
    ),
  );
}

export async function setTag(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  const tag = validateTag(interaction.options.getString('tag', true), server.guildId);
  saveClientServer(server.guildId, { tag });
  await replyPrivately(
    interaction,
    `**${serverName(interaction.client, server)}** now uses the tag \`${tag}\`. Existing channels keep their names.`,
  );
}

export async function pause(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  const message = interaction.options.getString('message')?.trim() || null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await pauseClient(interaction.client, server.guildId, message);
  await replyPrivately(
    interaction,
    `Paused **${serverName(interaction.client, server)}**. Open tickets keep working.`,
  );
}

export async function resume(interaction: CommandInteraction): Promise<void> {
  const server = chosenServer(interaction);
  if (server.status === 'paused' && !findCategory(interaction.guild, server.hubCategoryId)) {
    throw new UserFacingError(
      'Its hub category is gone. Set one with `/clients set-category` first.',
    );
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await resumeClient(interaction.client, server.guildId);
  await replyPrivately(
    interaction,
    `**${serverName(interaction.client, server)}** is taking tickets again.`,
  );
}
