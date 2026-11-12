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
import { hubChannelName } from './names.js';

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
    .setTitle(`🎫 Ticket #${padTicketNumber(ticket.number)}`)
    .setDescription(subjectText(ticket))
    .addFields(
      {
        name: 'Opened by',
        value: `${userMention(ticket.openerId)} · ${time(ticket.createdAt, TimestampStyles.ShortDateTime)}`,
      },
      { name: 'Status', value: clientStatus(ticket, context.helperLabel) },
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
    .setTitle(`🎫 ${hubChannelName(context.tag, ticket.number)} · ${context.serverName}`)
    .setDescription(subjectText(ticket))
    .addFields(
      {
        name: 'Opener',
        value: [
          `${userMention(opener.id)} (${escapeMarkdown(opener.username)} · ${opener.id})`,
          accountLine(opener, context.serverName),
          historyLine(context.history),
        ].join('\n'),
      },
      { name: 'Status', value: hubStatus(ticket) },
      ...closeReasonFields(ticket),
      ...participantFields(context.participantIds),
    );
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

function subjectText(ticket: Ticket): string {
  return truncate(ticket.subject.trim() || '(no text)', EMBED_DESCRIPTION_LIMIT);
}

function accountLine(opener: OpenerProfile, serverName: string): string {
  const created = `Account created ${time(opener.createdAt, TimestampStyles.RelativeTime)}`;
  const joined = opener.joinedAt
    ? `Joined ${escapeMarkdown(serverName)} ${time(opener.joinedAt, TimestampStyles.RelativeTime)}`
    : 'Not in the server anymore';
  return `${created} · ${joined}`;
}

function historyLine(history: OpenerHistory): string {
  if (history.priorCount === 0) return 'Prior tickets: none';
  const lastClosed = history.lastClosedAt
    ? ` (last closed ${time(history.lastClosedAt, TimestampStyles.RelativeTime)})`
    : '';
  return `Prior tickets: ${history.priorCount}${lastClosed}`;
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
