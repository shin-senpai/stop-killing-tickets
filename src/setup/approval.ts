import {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId } from '../core/customId.js';
import { UserFacingError } from '../core/errors.js';
import type { ComponentHandler } from '../core/module.js';
import { getClientServer } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { findCategory } from './channels.js';
import { serverName } from './format.js';
import { requireHubAdmin } from './guards.js';
import { SetupComponentIds } from './ids.js';
import { approveClient, rejectClient, suggestTag, TAG_MAX_LENGTH, validateTag } from './linking.js';
import { missingPermissionLine } from './permissionReport.js';

const TAG_FIELD = 'tag';
const CATEGORY_FIELD = 'category';

function requirePendingServer(guildId: string | undefined): ClientServer {
  const server = guildId ? getClientServer(guildId) : undefined;
  if (!server) throw new UserFacingError('That server isn’t registered anymore.');
  if (server.status !== 'pending') {
    throw new UserFacingError('This request was already handled.');
  }
  return server;
}

function buildApproveModal(guildId: string, suggestedTag: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(customId(SetupComponentIds.linkApproveModal, guildId))
    .setTitle('Approve server')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Tag')
        .setDescription('Short name for hub channels, like acme-0042.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(TAG_FIELD)
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(TAG_MAX_LENGTH)
            .setValue(suggestedTag),
        ),
      new LabelBuilder()
        .setLabel('Hub category')
        .setDescription('Where this server’s tickets will appear.')
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(CATEGORY_FIELD)
            .setChannelTypes(ChannelType.GuildCategory)
            .setMinValues(1)
            .setMaxValues(1),
        ),
    );
}

const approveButton: ComponentHandler = {
  id: SetupComponentIds.linkApprove,
  async handle(interaction, [guildId]) {
    if (!interaction.isButton()) return;
    requireHubAdmin(interaction.member);
    const server = requirePendingServer(guildId);
    const name = serverName(interaction.client, server);
    await interaction.showModal(buildApproveModal(server.guildId, suggestTag(name)));
  },
};

const approveModal: ComponentHandler = {
  id: SetupComponentIds.linkApproveModal,
  async handle(interaction, [guildId]) {
    if (!interaction.isModalSubmit()) return;
    requireHubAdmin(interaction.member);
    const server = requirePendingServer(guildId);
    const tag = validateTag(interaction.fields.getTextInputValue(TAG_FIELD), server.guildId);
    const selectedId = interaction.fields.getSelectedChannels(CATEGORY_FIELD, true).firstKey();
    const category = findCategory(interaction.guild, selectedId ?? null);
    if (!category) throw new UserFacingError('Pick a category in this server.');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await approveClient(interaction.client, server.guildId, {
      tag,
      hubCategoryId: category.id,
      approvedBy: interaction.user,
    });
    const warning = missingPermissionLine(category);
    const name = serverName(interaction.client, server);
    await interaction.editReply(
      [`Approved **${name}** as \`${tag}\`.`, warning].filter(Boolean).join('\n'),
    );
  },
};

const rejectButton: ComponentHandler = {
  id: SetupComponentIds.linkReject,
  async handle(interaction, [guildId]) {
    if (!interaction.isButton()) return;
    requireHubAdmin(interaction.member);
    const server = requirePendingServer(guildId);
    await interaction.deferUpdate();
    await rejectClient(interaction.client, server.guildId, interaction.user);
  },
};

export const approvalComponents: ComponentHandler[] = [approveButton, approveModal, rejectButton];
