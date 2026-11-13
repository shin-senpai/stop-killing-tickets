import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TimestampStyles,
  escapeMarkdown,
  time,
  userMention,
  type APIEmbedField,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { customId } from '../core/customId.js';
import { EMBED_DESCRIPTION_LIMIT } from '../core/limits.js';
import { padTicketNumber, truncate } from '../core/text.js';
import type { Ticket } from '../db/schema.js';
import { TicketComponentIds } from './ids.js';

const FIELD_LIMIT = 1024;

export interface OpenerProfile {
  id: string;
  username: string;
  createdAt: Date;
  /** Null when the opener left the client server. */
  joinedAt: Date | null;
}

export interface OpenerHistory {
  priorCount: number;
  lastClosedAt: Date | null;
}

export interface StarterContext {
  ticket: Ticket;
  tag: string;
  serverName: string;
  serverIconUrl: string | null;
  opener: OpenerProfile;
  history: OpenerHistory;
  participantIds: string[];
  /** How the claiming staff member is named to the user. Null when unclaimed. */
  helperLabel: string | null;
}

export interface StarterMessage {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

export function renderClientStarter(context: StarterContext): StarterMessage {
  const { ticket } = context;
  const embed = new EmbedBuilder()
    .setColor(statusColor(ticket))
    .setTitle(ticketTitle(ticket))
    .setDescription(subjectQuote(ticket))
    .addFields(
      { name: 'Opened by', value: userMention(ticket.openerId), inline: true },
      {
        name: 'Opened',
        value: time(ticket.createdAt, TimestampStyles.ShortDateTime),
        inline: true,
      },
      { name: 'Status', value: clientStatus(ticket, context.helperLabel), inline: true },
      ...closeReasonFields(ticket),
      ...participantFields(context.participantIds),
    );
  return { embeds: [embed], components: clientButtons(ticket) };
}

export function renderHubStarter(context: StarterContext): StarterMessage {
  const { ticket, opener } = context;
  const embed = new EmbedBuilder()
    .setColor(statusColor(ticket))
    .setAuthor({ name: context.serverName, iconURL: context.serverIconUrl ?? undefined })
    .setTitle(ticketTitle(ticket))
    .setDescription(subjectQuote(ticket))
    .addFields(
      {
        name: 'Opener',
        value: `${userMention(opener.id)}\n${escapeMarkdown(opener.username)}`,
        inline: true,
      },
      {
        name: 'Account created',
        value: time(opener.createdAt, TimestampStyles.RelativeTime),
        inline: true,
      },
      { name: 'Joined server', value: joinedText(opener), inline: true },
      { name: 'Prior tickets', value: historyText(context.history), inline: true },
      { name: 'Status', value: hubStatus(ticket), inline: true },
      ...closeReasonFields(ticket),
      ...participantFields(context.participantIds),
    )
    .setFooter({ text: `User ID: ${opener.id}` });
  return { embeds: [embed], components: [hubButtons(ticket)] };
}

export function clientStatus(ticket: Ticket, helperLabel: string | null): string {
  if (ticket.status === 'open') {
    return helperLabel
      ? `🟢 Open · ${escapeMarkdown(helperLabel)} is helping you`
      : '🟢 Open · Waiting for support';
  }
  return closedStatus(ticket);
}

export function hubStatus(ticket: Ticket): string {
  if (ticket.status === 'open') {
    return ticket.claimedBy
      ? `🟢 Open · Claimed by ${userMention(ticket.claimedBy)}`
      : '🟢 Open · Unclaimed';
  }
  return closedStatus(ticket);
}

function closedStatus(ticket: Ticket): string {
  if (ticket.status === 'closing' && ticket.closingUntil) {
    return `🟠 Closed · Can be reopened until ${time(ticket.closingUntil, TimestampStyles.ShortTime)}`;
  }
  return ticket.status === 'closing' ? '🟠 Closed' : '⚫ Closed';
}

function statusColor(ticket: Ticket): number {
  if (ticket.status === 'closing') return Colors.closing;
  if (ticket.status === 'closed') return Colors.closed;
  return ticket.claimedBy ? Colors.claimed : Colors.open;
}

function ticketTitle(ticket: Ticket): string {
  return `Ticket #${padTicketNumber(ticket.number)}`;
}

function subjectQuote(ticket: Ticket): string {
  const subject = escapeMarkdown(ticket.subject.trim() || '(no text)');
  const quote = subject
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return truncate(quote, EMBED_DESCRIPTION_LIMIT);
}

function joinedText(opener: OpenerProfile): string {
  return opener.joinedAt
    ? time(opener.joinedAt, TimestampStyles.RelativeTime)
    : 'Not in the server anymore';
}

function historyText(history: OpenerHistory): string {
  if (history.priorCount === 0) return 'None';
  const lastClosed = history.lastClosedAt
    ? `\nLast closed ${time(history.lastClosedAt, TimestampStyles.RelativeTime)}`
    : '';
  return `${history.priorCount}${lastClosed}`;
}

function closeReasonFields(ticket: Ticket): APIEmbedField[] {
  if (ticket.status === 'open' || !ticket.closeReason) return [];
  return [{ name: 'Reason', value: truncate(ticket.closeReason, FIELD_LIMIT) }];
}

function participantFields(participantIds: string[]): APIEmbedField[] {
  if (participantIds.length === 0) return [];
  return [
    {
      name: 'Participants',
      value: truncate(participantIds.map(userMention).join(', '), FIELD_LIMIT),
    },
  ];
}

function clientButtons(ticket: Ticket): ActionRowBuilder<ButtonBuilder>[] {
  if (ticket.status === 'closed') return [];
  if (ticket.status === 'closing') return [buttonRow(reopenButton(ticket))];
  return [
    buttonRow(
      new ButtonBuilder()
        .setCustomId(customId(TicketComponentIds.addPeople, ticket.id))
        .setLabel('Add people')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      closeButton(ticket),
    ),
  ];
}

function hubButtons(ticket: Ticket): ActionRowBuilder<ButtonBuilder> {
  const info = new ButtonBuilder()
    .setCustomId(customId(TicketComponentIds.info, ticket.id))
    .setLabel('Info')
    .setEmoji('📄')
    .setStyle(ButtonStyle.Secondary);
  if (ticket.status === 'closed') return buttonRow(info);
  if (ticket.status === 'closing') return buttonRow(reopenButton(ticket), info);
  const claim = new ButtonBuilder()
    .setCustomId(customId(TicketComponentIds.claim, ticket.id))
    .setLabel('Claim')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Primary);
  return buttonRow(claim, closeButton(ticket), info);
}

function closeButton(ticket: Ticket): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId(TicketComponentIds.close, ticket.id))
    .setLabel('Close')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);
}

function reopenButton(ticket: Ticket): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId(TicketComponentIds.reopen, ticket.id))
    .setLabel('Reopen')
    .setEmoji('🔓')
    .setStyle(ButtonStyle.Success);
}

function buttonRow(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}
