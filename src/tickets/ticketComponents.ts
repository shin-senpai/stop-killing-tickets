import { MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../core/module.js';
import { ticketFromComponent } from './access.js';
import { claimTicket } from './claim.js';
import { TicketComponentIds } from './ids.js';
import { buildTicketInfo } from './info.js';
import { participantComponents } from './participantPanel.js';

const claimButton: ComponentHandler = {
  id: TicketComponentIds.claim,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const scope = ticketFromComponent(ticketId, interaction.channelId);
    await interaction.deferUpdate();
    await claimTicket(interaction.client, scope, interaction.member);
  },
};

const infoButton: ComponentHandler = {
  id: TicketComponentIds.info,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const scope = ticketFromComponent(ticketId, interaction.channelId);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({
      embeds: [await buildTicketInfo(interaction.client, scope)],
      allowedMentions: { parse: [] },
    });
  },
};

export const ticketComponents: ComponentHandler[] = [
  ...participantComponents,
  claimButton,
  infoButton,
];
