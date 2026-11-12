import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from './index.js';
import {
  blacklist,
  clientServers,
  hubConfig,
  ticketParticipants,
  tickets,
  type ClientServer,
  type HubConfig,
  type Ticket,
  type TicketSide,
} from './schema.js';

const HUB_CONFIG_ID = 1;

export function getHubConfig(): HubConfig {
  const existing = db.select().from(hubConfig).where(eq(hubConfig.id, HUB_CONFIG_ID)).get();
  if (existing) return existing;
  return db.insert(hubConfig).values({ id: HUB_CONFIG_ID }).returning().get();
}

export function updateHubConfig(values: Partial<Omit<HubConfig, 'id'>>): HubConfig {
  getHubConfig();
  return db.update(hubConfig).set(values).where(eq(hubConfig.id, HUB_CONFIG_ID)).returning().get()!;
}

export function getClientServer(guildId: string): ClientServer | undefined {
  return db.select().from(clientServers).where(eq(clientServers.guildId, guildId)).get();
}

export function updateClientServer(
  guildId: string,
  values: Partial<Omit<ClientServer, 'guildId'>>,
): ClientServer | undefined {
  return db
    .update(clientServers)
    .set(values)
    .where(eq(clientServers.guildId, guildId))
    .returning()
    .get();
}

export function getTicket(id: number): Ticket | undefined {
  return db.select().from(tickets).where(eq(tickets.id, id)).get();
}

export interface TicketLocation {
  ticket: Ticket;
  side: TicketSide;
}

/** Finds the ticket that owns a channel on either side. Closed tickets are included. */
export function findTicketByChannel(channelId: string): TicketLocation | undefined {
  const ticket = db
    .select()
    .from(tickets)
    .where(or(eq(tickets.clientChannelId, channelId), eq(tickets.hubChannelId, channelId)))
    .get();
  if (!ticket) return undefined;
  return { ticket, side: ticket.clientChannelId === channelId ? 'client' : 'hub' };
}

export function updateTicket(id: number, values: Partial<Omit<Ticket, 'id'>>): Ticket | undefined {
  return db.update(tickets).set(values).where(eq(tickets.id, id)).returning().get();
}

export function getActiveTickets(): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(inArray(tickets.status, ['open', 'closing']))
    .all();
}

export function getParticipantIds(ticketId: number): string[] {
  return db
    .select({ userId: ticketParticipants.userId })
    .from(ticketParticipants)
    .where(eq(ticketParticipants.ticketId, ticketId))
    .all()
    .map((row) => row.userId);
}

/** True when the user is blocked in this client server or globally. */
export function isBlacklisted(userId: string, clientGuildId: string): boolean {
  return (
    db
      .select({ userId: blacklist.userId })
      .from(blacklist)
      .where(
        and(
          eq(blacklist.userId, userId),
          or(eq(blacklist.scope, clientGuildId), eq(blacklist.scope, 'global')),
        ),
      )
      .get() !== undefined
  );
}
