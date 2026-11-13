import {
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Colors } from '../../../core/colors.js';
import type { ComponentHandler } from '../../../core/module.js';
import { findTextChannel } from '../../channels.js';
import { requireClientServer, requireServerAdmin } from '../../guards.js';
import { SetupComponentIds } from '../../ids.js';
import { INTAKE_TEXT_LIMIT } from '../../intakeMessage.js';
import type { CommandInteraction } from '../subcommands.js';

const TEXT_FIELD = 'text';

export async function openIntakePostModal(interaction: CommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(SetupComponentIds.intakePostModal)
    .setTitle('Post in the intake channel')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Message')
        .setDescription('The bot posts this text in the intake channel.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(TEXT_FIELD)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(INTAKE_TEXT_LIMIT),
        ),
    );
  await interaction.showModal(modal);
}

export const intakePostModal: ComponentHandler = {
  id: SetupComponentIds.intakePostModal,
  async handle(interaction) {
    if (!interaction.isModalSubmit()) return;
    requireServerAdmin(interaction.member);
    const server = requireClientServer(interaction.guildId);
    const text = interaction.fields.getTextInputValue(TEXT_FIELD).trim();
    if (text === '') {
      await interaction.reply({ content: 'The message is empty.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = findTextChannel(interaction.guild, server.intakeChannelId);
    if (!channel) {
      await interaction.editReply('I can’t find the intake channel. Run `/config check`.');
      return;
    }
    try {
      await channel.send({
        embeds: [new EmbedBuilder().setColor(Colors.info).setDescription(text)],
        allowedMentions: { parse: [] },
      });
      await interaction.editReply(`Posted in ${channel}.`);
    } catch {
      await interaction.editReply('I couldn’t post in the intake channel. Run `/config check`.');
    }
  },
};
