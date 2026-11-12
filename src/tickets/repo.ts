import { and, count, eq, inArray, isNotNull, lt, lte, max, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  categoryOverflows,
  clientServers,
  ticketParticipants,
  tickets,
  type Ticket,
  type TicketSide,
} from '../db/schema.js';
import type { OpenerHistory } from './starterView.js';

export type NewTicket = typeof tickets.$inferInsert;
export type TicketPatch = Partial<Omit<Ticket, 'id' | 'status'>>;

/** Reserves the next ticket number of a client server. Numbers are never reused. */
export function allocateTicketNumber(clientGuildId: string): number {
  return db.transaction((tx) => {
    const row = tx
      .update(clientServers)
      .set({ nextTicketNumber: sql`${clientServers.nextTicketNumber} + 1` })
      .where(eq(clientServers.guildId, clientGuildId))
      .returning({ next: clientServers.nextTicketNumber })
      .get();
    if (!row) throw new Error(`Client server ${clientGuildId} not found`);
    return row.next - 1;
  });
}

export function insertTicket(values: NewTicket): Ticket {
  return db.insert(tickets).values(values).returning().get();
}

export function deleteTicket(id: number): void {
  db.delete(tickets).where(eq(tickets.id, id)).run();
}

export function getOpenTicketsOfOpener(clientGuildId: string, openerId: string): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.clientGuildId, clientGuildId),
        eq(tickets.openerId, openerId),
        eq(tickets.status, 'open'),
      ),
    )
    .all();
}

export function getLastClosedAt(clientGuildId: string, openerId: string): Date | null {
  const row = db
    .select({ lastClosedAt: max(tickets.closedAt) })
    .from(tickets)
    .where(and(eq(tickets.clientGuildId, clientGuildId), eq(tickets.openerId, openerId)))
    .get();
  return row?.lastClosedAt ?? null;
}

/** Tickets the opener had in this client server before the given one. */
export function getOpenerHistory(ticket: Ticket): OpenerHistory {
  const row = db
    .select({ priorCount: count(), lastClosedAt: max(tickets.closedAt) })
    .from(tickets)
    .where(
      and(
        eq(tickets.clientGuildId, ticket.clientGuildId),
        eq(tickets.openerId, ticket.openerId),
        lt(tickets.id, ticket.id),
      ),
    )
    .get();
  return { priorCount: row?.priorCount ?? 0, lastClosedAt: row?.lastClosedAt ?? null };
}

export function getActiveTicketsOfClient(clientGuildId: string): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(
      and(eq(tickets.clientGuildId, clientGuildId), inArray(tickets.status, ['open', 'closing'])),
    )
    .all();
}

export function getTicketsDueForFinalize(now: Date): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.status, 'closing'), lte(tickets.closingUntil, now)))
    .all();
}

/** Open tickets where staff have written, the only ones auto-close can apply to. */
export function getAutoCloseCandidates(): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.status, 'open'), isNotNull(tickets.lastStaffActivityAt)))
    .all();
}

/** Moves an open ticket to 'closing'. Returns undefined if it was not open. */
export function markTicketClosing(id: number, values: TicketPatch): Ticket | undefined {
  return db
    .update(tickets)
    .set({ ...values, status: 'closing' })
    .where(and(eq(tickets.id, id), eq(tickets.status, 'open')))
    .returning()
    .get();
}

/** Moves a closing ticket back to 'open'. Returns undefined if it was not closing. */
export function markTicketReopened(id: number, values: TicketPatch): Ticket | undefined {
  return db
    .update(tickets)
    .set({
      ...values,
      status: 'open',
      closingUntil: null,
      closedAt: null,
      closedBy: null,
      closeReason: null,
      autoCloseWarnedAt: null,
    })
    .where(and(eq(tickets.id, id), eq(tickets.status, 'closing')))
    .returning()
    .get();
}

export function markTicketClosed(id: number, values: TicketPatch): Ticket | undefined {
  return db
    .update(tickets)
    .set({ ...values, status: 'closed', closingUntil: null })
    .where(eq(tickets.id, id))
    .returning()
    .get();
}

export function clearTicketSide(id: number, side: TicketSide): Ticket | undefined {
  return db.update(tickets).set(emptySide(side)).where(eq(tickets.id, id)).returning().get();
}

export function emptySide(side: TicketSide): TicketPatch {
  return side === 'client'
    ? {
        clientChannelId: null,
        clientWebhookId: null,
        clientWebhookToken: null,
        clientStarterMessageId: null,
      }
    : { hubChannelId: null, hubWebhookId: null, hubWebhookToken: null, hubStarterMessageId: null };
}

export function setAutoCloseWarnedAt(id: number, warnedAt: Date): void {
  db.update(tickets).set({ autoCloseWarnedAt: warnedAt }).where(eq(tickets.id, id)).run();
}

/** Open or closing tickets of a client server in which the user is a participant. */
export function getTicketsWithParticipant(clientGuildId: string, userId: string): Ticket[] {
  return db
    .select({ ticket: tickets })
    .from(tickets)
    .innerJoin(ticketParticipants, eq(ticketParticipants.ticketId, tickets.id))
    .where(
      and(
        eq(tickets.clientGuildId, clientGuildId),
        inArray(tickets.status, ['open', 'closing']),
        eq(ticketParticipants.userId, userId),
      ),
    )
    .all()
    .map((row) => row.ticket);
}

export function addParticipantRows(ticketId: number, userIds: string[], addedBy: string): void {
  if (userIds.length === 0) return;
  db.insert(ticketParticipants)
    .values(userIds.map((userId) => ({ ticketId, userId, addedBy })))
    .onConflictDoNothing()
    .run();
}

export function removeParticipantRows(ticketId: number, userIds: string[]): void {
  if (userIds.length === 0) return;
  db.delete(ticketParticipants)
    .where(
      and(eq(ticketParticipants.ticketId, ticketId), inArray(ticketParticipants.userId, userIds)),
    )
    .run();
}

export function getOverflowCategoryIds(baseCategoryId: string): string[] {
  return db
    .select({ categoryId: categoryOverflows.categoryId })
    .from(categoryOverflows)
    .where(eq(categoryOverflows.baseCategoryId, baseCategoryId))
    .all()
    .map((row) => row.categoryId);
}

export function addOverflowCategory(baseCategoryId: string, categoryId: string): void {
  db.insert(categoryOverflows).values({ baseCategoryId, categoryId }).run();
}

export function removeOverflowCategory(baseCategoryId: string, categoryId: string): void {
  db.delete(categoryOverflows)
    .where(
      and(
        eq(categoryOverflows.baseCategoryId, baseCategoryId),
        eq(categoryOverflows.categoryId, categoryId),
      ),
    )
    .run();
}

interface StarterRecord {
  clientStarterMessageId: string;
  hubStarterMessageId: string;
  clientLastMessageId: string;
  hubLastMessageId: string;
}

/** Seeds the catch-up positions only where the relay has not already set them. */
export function recordStarterMessages(ticketId: number, record: StarterRecord): Ticket {
  const row = db
    .update(tickets)
    .set({
      clientStarterMessageId: record.clientStarterMessageId,
      hubStarterMessageId: record.hubStarterMessageId,
      lastRelayedClientMessageId: sql`coalesce(${tickets.lastRelayedClientMessageId}, ${record.clientLastMessageId})`,
      lastRelayedHubMessageId: sql`coalesce(${tickets.lastRelayedHubMessageId}, ${record.hubLastMessageId})`,
    })
    .where(eq(tickets.id, ticketId))
    .returning()
    .get();
  if (!row) throw new Error(`Ticket ${ticketId} disappeared while it was being created`);
  return row;
}
