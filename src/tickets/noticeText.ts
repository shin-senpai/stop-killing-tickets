import { time, TimestampStyles } from 'discord.js';
import { padTicketNumber } from '../core/text.js';
import type { TicketSide } from '../db/schema.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short human duration such as "2d 3h", "4h 10m" or "5m". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return 'less than a minute';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export function ticketLabel(tag: string | null, number: number): string {
  return `${tag ?? 'ticket'}-${padTicketNumber(number)}`;
}

export interface Actor {
  id: string;
  /** How the actor is named in the client server: a mention, or a staff label. */
  clientLabel: string;
}

export function actorLabel(actor: Actor, audience: TicketSide): string {
  return audience === 'hub' ? `<@${actor.id}>` : actor.clientLabel;
}

export function relativeTime(date: Date): string {
  return time(date, TimestampStyles.RelativeTime);
}

export interface CloseNoticeInput {
  closer: Actor | null;
  reason: string | null;
  closingUntil: Date;
  audience: TicketSide;
  channelFate: 'deleted' | 'archived';
}

export function closeNoticeText(input: CloseNoticeInput): string {
  const who = input.closer
    ? `Ticket closed by ${actorLabel(input.closer, input.audience)}.`
    : 'Ticket closed automatically.';
  return [
    `🔒 ${who}`,
    input.reason ? `Reason: ${input.reason}` : null,
    `This channel will be ${input.channelFate} ${relativeTime(input.closingUntil)}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function reopenNoticeText(actor: Actor, audience: TicketSide): string {
  return `🔓 Ticket reopened by ${actorLabel(actor, audience)}.`;
}
