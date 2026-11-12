import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** Single row (id = 1). The hub guild ID itself comes from the environment. */
export const hubConfig = sqliteTable('hub_config', {
  id: integer('id').primaryKey(),
  logChannelId: text('log_channel_id'),
  transcriptChannelId: text('transcript_channel_id'),
  closedCategoryId: text('closed_category_id'),
  staffRoleIds: text('staff_role_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
  staffIdentity: text('staff_identity', { enum: ['named', 'anonymous', 'role'] })
    .notNull()
    .default('named'),
  notePrefix: text('note_prefix').notNull().default('//'),
  autoCloseWarnHours: integer('auto_close_warn_hours'),
  autoCloseCloseHours: integer('auto_close_close_hours'),
  archiveMode: text('archive_mode', { enum: ['delete', 'move'] })
    .notNull()
    .default('delete'),
  graceMinutes: integer('grace_minutes').notNull().default(10),
});

export const clientServers = sqliteTable('client_servers', {
  guildId: text('guild_id').primaryKey(),
  /** Last known server name, shown after the bot has left the server. */
  name: text('name'),
  status: text('status', { enum: ['pending', 'active', 'paused', 'unlinked'] })
    .notNull()
    .default('pending'),
  tag: text('tag').unique(),
  hubCategoryId: text('hub_category_id'),
  intakeChannelId: text('intake_channel_id'),
  intakeMessageId: text('intake_message_id'),
  ticketCategoryId: text('ticket_category_id'),
  logChannelId: text('log_channel_id'),
  staffRoleIds: text('staff_role_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
  /** Null means the default instruction text. */
  intakeText: text('intake_text'),
  pauseMessage: text('pause_message'),
  maxOpenTickets: integer('max_open_tickets').notNull().default(1),
  minSubjectLength: integer('min_subject_length').notNull().default(10),
  maxParticipants: integer('max_participants').notNull().default(5),
  participantsCanAdd: integer('participants_can_add', { mode: 'boolean' }).notNull().default(false),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(0),
  dmTranscripts: integer('dm_transcripts', { mode: 'boolean' }).notNull().default(true),
  nextTicketNumber: integer('next_ticket_number').notNull().default(1),
  /** The approve/reject message in the hub log channel. */
  linkRequestMessageId: text('link_request_message_id'),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
});

/** Extra categories created when a base category is full. */
export const categoryOverflows = sqliteTable(
  'category_overflows',
  {
    baseCategoryId: text('base_category_id').notNull(),
    categoryId: text('category_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.baseCategoryId, t.categoryId] })],
);

export const tickets = sqliteTable(
  'tickets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientGuildId: text('client_guild_id')
      .notNull()
      .references(() => clientServers.guildId),
    number: integer('number').notNull(),
    openerId: text('opener_id').notNull(),
    subject: text('subject').notNull(),
    status: text('status', { enum: ['open', 'closing', 'closed'] })
      .notNull()
      .default('open'),

    clientChannelId: text('client_channel_id'),
    clientWebhookId: text('client_webhook_id'),
    clientWebhookToken: text('client_webhook_token'),
    clientStarterMessageId: text('client_starter_message_id'),

    hubChannelId: text('hub_channel_id'),
    hubWebhookId: text('hub_webhook_id'),
    hubWebhookToken: text('hub_webhook_token'),
    hubStarterMessageId: text('hub_starter_message_id'),

    claimedBy: text('claimed_by'),
    createdAt: createdAt(),
    lastOpenerActivityAt: integer('last_opener_activity_at', { mode: 'timestamp_ms' }),
    lastStaffActivityAt: integer('last_staff_activity_at', { mode: 'timestamp_ms' }),
    autoCloseWarnedAt: integer('auto_close_warned_at', { mode: 'timestamp_ms' }),
    /** End of the reopen grace period. Channels are deleted or archived after this time. */
    closingUntil: integer('closing_until', { mode: 'timestamp_ms' }),
    closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
    closedBy: text('closed_by'),
    closeReason: text('close_reason'),

    /** Used to relay messages that were sent while the bot was offline. */
    lastRelayedClientMessageId: text('last_relayed_client_message_id'),
    lastRelayedHubMessageId: text('last_relayed_hub_message_id'),
  },
  (t) => [
    uniqueIndex('tickets_client_number_idx').on(t.clientGuildId, t.number),
    index('tickets_client_channel_idx').on(t.clientChannelId),
    index('tickets_hub_channel_idx').on(t.hubChannelId),
    index('tickets_opener_status_idx').on(t.openerId, t.status),
  ],
);

export const ticketParticipants = sqliteTable(
  'ticket_participants',
  {
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    addedBy: text('added_by').notNull(),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.userId] })],
);

/**
 * Maps a source message to its relayed copy. A long source message can produce
 * several copies (one per 2000-character chunk), so `copyIndex` is part of the key.
 */
export const messageLinks = sqliteTable(
  'message_links',
  {
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    sourceSide: text('source_side', { enum: ['client', 'hub'] }).notNull(),
    sourceMessageId: text('source_message_id').notNull(),
    copyIndex: integer('copy_index').notNull().default(0),
    copyMessageId: text('copy_message_id').notNull(),
    authorId: text('author_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceMessageId, t.copyIndex] }),
    index('message_links_copy_idx').on(t.copyMessageId),
  ],
);

export const blacklist = sqliteTable(
  'blacklist',
  {
    /** A client guild ID, or 'global' for a block across all client servers. */
    scope: text('scope').notNull(),
    userId: text('user_id').notNull(),
    reason: text('reason'),
    addedBy: text('added_by').notNull(),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.userId] })],
);

export type HubConfig = typeof hubConfig.$inferSelect;
export type ClientServer = typeof clientServers.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketParticipant = typeof ticketParticipants.$inferSelect;
export type MessageLink = typeof messageLinks.$inferSelect;
export type BlacklistEntry = typeof blacklist.$inferSelect;
export type TicketSide = 'client' | 'hub';
