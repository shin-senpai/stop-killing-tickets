import type { Ticket, TicketSide } from '../db/schema.js';

export interface RelayedAuthor {
  side: TicketSide;
  authorId: string;
  isStaff: boolean;
}

/** Ticket fields that track activity for auto-close, after a relayed message. */
export function activityChanges(
  ticket: Pick<Ticket, 'openerId'>,
  author: RelayedAuthor,
  now: Date,
): Partial<Ticket> {
  const changes: Partial<Ticket> = {};
  if (author.side === 'client' && author.authorId === ticket.openerId) {
    changes.lastOpenerActivityAt = now;
    changes.autoCloseWarnedAt = null;
  }
  if (author.side === 'hub' || author.isStaff) changes.lastStaffActivityAt = now;
  return changes;
}
