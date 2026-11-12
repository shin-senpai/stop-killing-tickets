import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { updateClientServer } from '../db/queries.js';
import {
  blacklist,
  clientServers,
  tickets,
  type BlacklistEntry,
  type ClientServer,
} from '../db/schema.js';

export const GLOBAL_BLACKLIST_SCOPE = 'global';

export function insertClientServer(values: typeof clientServers.$inferInsert): ClientServer {
  return db.insert(clientServers).values(values).returning().get();
}

export function listClientServers(): ClientServer[] {
  return db.select().from(clientServers).all();
}

export function listLinkedClientServers(): ClientServer[] {
  return db.select().from(clientServers).where(ne(clientServers.status, 'unlinked')).all();
}

export function findClientByTag(tag: string): ClientServer | undefined {
  return db.select().from(clientServers).where(eq(clientServers.tag, tag)).get();
}

export function isTagTaken(tag: string, exceptGuildId: string): boolean {
  const owner = findClientByTag(tag);
  return owner !== undefined && owner.guildId !== exceptGuildId;
}

export function findClientsByHubCategory(categoryId: string): ClientServer[] {
  return db
    .select()
    .from(clientServers)
    .where(and(eq(clientServers.hubCategoryId, categoryId), ne(clientServers.status, 'unlinked')))
    .all();
}

export function isIntakeChannel(channelId: string): boolean {
  return (
    db
      .select({ guildId: clientServers.guildId })
      .from(clientServers)
      .where(eq(clientServers.intakeChannelId, channelId))
      .get() !== undefined
  );
}

export function countActiveTicketsByClient(): Map<string, number> {
  const rows = db
    .select({ guildId: tickets.clientGuildId, count: sql<number>`count(*)` })
    .from(tickets)
    .where(inArray(tickets.status, ['open', 'closing']))
    .groupBy(tickets.clientGuildId)
    .all();
  return new Map(rows.map((row) => [row.guildId, row.count]));
}

export function upsertBlacklistEntry(
  scope: string,
  userId: string,
  reason: string | null,
  addedBy: string,
): void {
  db.insert(blacklist)
    .values({ scope, userId, reason, addedBy })
    .onConflictDoUpdate({
      target: [blacklist.scope, blacklist.userId],
      set: { reason, addedBy, addedAt: new Date() },
    })
    .run();
}

export function deleteBlacklistEntry(scope: string, userId: string): boolean {
  const result = db
    .delete(blacklist)
    .where(and(eq(blacklist.scope, scope), eq(blacklist.userId, userId)))
    .run();
  return result.changes > 0;
}

export function listBlacklist(scope: string): BlacklistEntry[] {
  return db
    .select()
    .from(blacklist)
    .where(eq(blacklist.scope, scope))
    .orderBy(blacklist.addedAt)
    .all();
}

/** Like updateClientServer, for callers that already know the row exists. */
export function saveClientServer(
  guildId: string,
  values: Partial<Omit<ClientServer, 'guildId'>>,
): ClientServer {
  const updated = updateClientServer(guildId, values);
  if (!updated) throw new Error(`Client server ${guildId} not found`);
  return updated;
}
