import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { customId } from '../core/customId.js';
import { UserFacingError } from '../core/errors.js';
import type { ComponentHandler, ComponentInteraction } from '../core/module.js';
import { getHubConfig } from '../db/queries.js';
import type { Ticket } from '../db/schema.js';
import {
  isTicketStaff,
  requireCanCloseOrReopen,
  requireOpen,
  requireReopenWithinLimit,
  ticketFromComponent,
  type TicketScope,
} from './access.js';
import { closeTicket, reopenTicket } from './close.js';
import { TicketComponentIds } from './ids.js';

const REASON_INPUT_ID = 'reason';
const REASON_MAX_LENGTH = 500;

function scopeForAction(
  interaction: ComponentInteraction,
  ticketId: string | undefined,
): TicketScope {
  const scope = ticketFromComponent(ticketId, interaction.channelId ?? '');
  requireCanCloseOrReopen(interaction.member, scope);
  return scope;
}

function ticketForAction(interaction: ComponentInteraction, ticketId: string | undefined): Ticket {
  return scopeForAction(interaction, ticketId).ticket;
}

function confirmText(): string {
  const { graceMinutes } = getHubConfig();
  if (graceMinutes <= 0) return 'Close this ticket?';
  return `Close this ticket? It can be reopened for ${graceMinutes} minute${graceMinutes === 1 ? '' : 's'}.`;
}

function confirmRow(ticketId: number, canCloseNow: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(TicketComponentIds.closeConfirm, ticketId))
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(customId(TicketComponentIds.closeReasonModal, ticketId))
      .setLabel('Close with reason')
      .setStyle(ButtonStyle.Secondary),
  );
  if (canCloseNow) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(customId(TicketComponentIds.closeNow, ticketId))
        .setLabel('Close now (no reopen)')
        .setStyle(ButtonStyle.Danger),
    );
  }
  return row;
}

function canCloseNow(interaction: ComponentInteraction, scope: TicketScope): boolean {
  return scope.side === 'hub' && isTicketStaff(interaction.member, scope);
}

function reasonModal(ticketId: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(customId(TicketComponentIds.closeReasonModal, ticketId))
    .setTitle('Close ticket')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Reason')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(REASON_INPUT_ID)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(REASON_MAX_LENGTH)
            .setRequired(true),
        ),
    );
}

const closeButton: ComponentHandler = {
  id: TicketComponentIds.close,
  async handle(interaction, [ticketId]) {
    const scope = scopeForAction(interaction, ticketId);
    requireOpen(scope.ticket);
    await interaction.reply({
      content: confirmText(),
      components: [confirmRow(scope.ticket.id, canCloseNow(interaction, scope))],
      flags: MessageFlags.Ephemeral,
    });
  },
};

const closeConfirmButton: ComponentHandler = {
  id: TicketComponentIds.closeConfirm,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const ticket = ticketForAction(interaction, ticketId);
    requireOpen(ticket);
    await interaction.update({ content: 'Closing the ticket…', components: [] });
    await closeTicket(interaction.client, ticket, interaction.user, null);
    await interaction.editReply({ content: 'Ticket closed.' });
  },
};

const closeNowButton: ComponentHandler = {
  id: TicketComponentIds.closeNow,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const scope = scopeForAction(interaction, ticketId);
    if (!canCloseNow(interaction, scope)) {
      throw new UserFacingError('Only hub staff can close a ticket at once.');
    }
    requireOpen(scope.ticket);
    await interaction.update({ content: 'Closing the ticket for good…', components: [] });
    await closeTicket(interaction.client, scope.ticket, interaction.user, null, {
      immediate: true,
    });
    await interaction.editReply({ content: 'Ticket closed for good.' });
  },
};

const closeWithReason: ComponentHandler = {
  id: TicketComponentIds.closeReasonModal,
  async handle(interaction, [ticketId]) {
    if (interaction.isButton()) await showReasonModal(interaction, ticketId);
    else if (interaction.isModalSubmit()) await closeWithSubmittedReason(interaction, ticketId);
  },
};

async function showReasonModal(
  interaction: ButtonInteraction<'cached'>,
  ticketId: string | undefined,
): Promise<void> {
  const ticket = ticketForAction(interaction, ticketId);
  requireOpen(ticket);
  await interaction.showModal(reasonModal(ticket.id));
}

async function closeWithSubmittedReason(
  interaction: ModalSubmitInteraction<'cached'>,
  ticketId: string | undefined,
): Promise<void> {
  const ticket = ticketForAction(interaction, ticketId);
  requireOpen(ticket);
  const reason = interaction.fields.getTextInputValue(REASON_INPUT_ID).trim() || null;

  if (interaction.isFromMessage()) {
    await interaction.update({ content: 'Closing the ticket…', components: [] });
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  await closeTicket(interaction.client, ticket, interaction.user, reason);
  await interaction.editReply({ content: 'Ticket closed.' });
}

const reopenButton: ComponentHandler = {
  id: TicketComponentIds.reopen,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const scope = scopeForAction(interaction, ticketId);
    const { ticket } = scope;
    if (ticket.status === 'open') throw new UserFacingError('This ticket is already open.');
    if (ticket.status !== 'closing') {
      throw new UserFacingError('This ticket can no longer be reopened.');
    }
    requireReopenWithinLimit(interaction.member, scope);
    await interaction.deferUpdate();
    await reopenTicket(interaction.client, ticket, interaction.user);
    // The starter message was already re-rendered with its open buttons; only a close notice loses its button.
    const starterIds = [ticket.clientStarterMessageId, ticket.hubStarterMessageId];
    if (!starterIds.includes(interaction.message.id)) {
      await interaction.editReply({ components: [] });
    }
  },
};

export const lifecycleComponents: ComponentHandler[] = [
  closeButton,
  closeConfirmButton,
  closeNowButton,
  closeWithReason,
  reopenButton,
];
