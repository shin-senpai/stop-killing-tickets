import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { customId } from '../../../core/customId.js';
import { UserFacingError } from '../../../core/errors.js';
import { sendHubLog } from '../../../core/hub.js';
import type { ComponentHandler } from '../../../core/module.js';
import { getClientServer } from '../../../db/queries.js';
import { serverName } from '../../format.js';
import { requireHubAdmin, resolveClientServer } from '../../guards.js';
import { SetupComponentIds } from '../../ids.js';
import { unlinkClient } from '../../linking.js';
import type { CommandInteraction } from '../subcommands.js';
import { SERVER_OPTION } from './definition.js';

export async function askToUnlink(interaction: CommandInteraction): Promise<void> {
  const server = resolveClientServer(interaction.options.getString(SERVER_OPTION, true));
  if (server.status === 'unlinked') throw new UserFacingError('That server isn’t connected.');
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(SetupComponentIds.unlinkConfirm, server.guildId))
      .setLabel('Unlink and close tickets')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(SetupComponentIds.unlinkCancel)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({
    content: `Unlink **${serverName(interaction.client, server)}**? All its open tickets will be closed.`,
    components: [buttons],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

const confirmUnlink: ComponentHandler = {
  id: SetupComponentIds.unlinkConfirm,
  async handle(interaction, [guildId]) {
    if (!interaction.isButton()) return;
    requireHubAdmin(interaction.member);
    const server = guildId ? getClientServer(guildId) : undefined;
    if (!server || server.status === 'unlinked') {
      throw new UserFacingError('That server isn’t connected anymore.');
    }
    const name = serverName(interaction.client, server);
    await interaction.update({ content: `Unlinking **${name}**…`, components: [] });
    await unlinkClient(
      interaction.client,
      server.guildId,
      'This server was disconnected from support',
    );
    await sendHubLog(
      interaction.client,
      `${interaction.user} unlinked **${name}** (\`${server.guildId}\`).`,
    );
    // Closing many tickets can outlast the 15-minute interaction token.
    await interaction
      .editReply(`Unlinked **${name}** and closed its tickets.`)
      .catch(() => undefined);
  },
};

const cancelUnlink: ComponentHandler = {
  id: SetupComponentIds.unlinkCancel,
  async handle(interaction) {
    if (!interaction.isButton()) return;
    await interaction.update({ content: 'Nothing changed.', components: [] });
  },
};

export const unlinkComponents: ComponentHandler[] = [confirmUnlink, cancelUnlink];
