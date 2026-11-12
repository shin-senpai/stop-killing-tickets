import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { ComponentHandler } from '../../../core/module.js';
import { requireClientServer, requireServerAdmin } from '../../guards.js';
import { SetupComponentIds } from '../../ids.js';
import { defaultIntakeText, INTAKE_TEXT_LIMIT, refreshIntakeMessage } from '../../intakeMessage.js';
import { saveClientServer } from '../../repo.js';
import type { CommandInteraction } from '../subcommands.js';

const TEXT_FIELD = 'text';

export async function openIntakeMessageModal(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  const modal = new ModalBuilder()
    .setCustomId(SetupComponentIds.intakeTextModal)
    .setTitle('Intake instructions')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Instructions')
        .setDescription('Shown in the intake channel. Clear it to use the default text.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(TEXT_FIELD)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(INTAKE_TEXT_LIMIT)
            .setValue(server.intakeText ?? defaultIntakeText(server)),
        ),
    );
  await interaction.showModal(modal);
}

export const intakeTextModal: ComponentHandler = {
  id: SetupComponentIds.intakeTextModal,
  async handle(interaction) {
    if (!interaction.isModalSubmit()) return;
    requireServerAdmin(interaction.member);
    const server = requireClientServer(interaction.guildId);
    const text = interaction.fields.getTextInputValue(TEXT_FIELD).trim();
    const isDefault = text === '' || text === defaultIntakeText(server);

    const updated = saveClientServer(server.guildId, { intakeText: isDefault ? null : text });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const posted = await refreshIntakeMessage(interaction.client, updated);
    await interaction.editReply(
      posted
        ? 'Instructions updated.'
        : 'Saved, but I couldn’t update the intake channel. Run `/config check`.',
    );
  },
};
