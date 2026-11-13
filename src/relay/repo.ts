import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { findTicketByChannel, getTicket, type TicketLocation } from '../db/queries.js';
import { messageLinks, type MessageLink, type Ticket, type TicketSide } from '../db/schema.js';

export interface NewMessageLink {
  ticketId: number;
  sourceSide: TicketSide;
  sourceMessageId: string;
  copyIndex: number;
  copyMessageId: string;
  authorId: string;
}

export function insertMessageLink(link: NewMessageLink): void {
  db.insert(messageLinks).values(link).run();
}

/** All copies of a source message, in chunk order. */
export function findCopies(sourceMessageId: string): MessageLink[] {
  return db
    .select()
    .from(messageLinks)
    .where(eq(messageLinks.sourceMessageId, sourceMessageId))
    .orderBy(asc(messageLinks.copyIndex))
    .all();
}

export function findLinkByCopy(copyMessageId: string): MessageLink | undefined {
  return db.select().from(messageLinks).where(eq(messageLinks.copyMessageId, copyMessageId)).get();
}

export function deleteCopyLinks(sourceMessageId: string): void {
  db.delete(messageLinks).where(eq(messageLinks.sourceMessageId, sourceMessageId)).run();
}

export function deleteCopyLink(sourceMessageId: string, copyIndex: number): void {
  db.delete(messageLinks)
    .where(
      and(eq(messageLinks.sourceMessageId, sourceMessageId), eq(messageLinks.copyIndex, copyIndex)),
    )
    .run();
}

export function deleteLinkByCopy(copyMessageId: string): void {
  db.delete(messageLinks).where(eq(messageLinks.copyMessageId, copyMessageId)).run();
}

/** Closed tickets, including those in the reopen grace period, are not relayed. */
function isRelayed(ticket: Ticket): boolean {
  return ticket.status === 'open';
}

export function findRelayedTicketByChannel(channelId: string): TicketLocation | undefined {
  const location = findTicketByChannel(channelId);
  return location && isRelayed(location.ticket) ? location : undefined;
}

export function getRelayedTicket(ticketId: number): Ticket | undefined {
  const ticket = getTicket(ticketId);
  return ticket && isRelayed(ticket) ? ticket : undefined;
}
