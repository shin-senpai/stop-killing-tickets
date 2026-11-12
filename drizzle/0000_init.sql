CREATE TABLE `blacklist` (
	`scope` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`added_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`scope`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `category_overflows` (
	`base_category_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`base_category_id`, `category_id`)
);
--> statement-breakpoint
CREATE TABLE `client_servers` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`tag` text,
	`hub_category_id` text,
	`intake_channel_id` text,
	`intake_message_id` text,
	`ticket_category_id` text,
	`log_channel_id` text,
	`staff_role_ids` text DEFAULT '[]' NOT NULL,
	`intake_text` text,
	`pause_message` text,
	`max_open_tickets` integer DEFAULT 1 NOT NULL,
	`min_subject_length` integer DEFAULT 10 NOT NULL,
	`max_participants` integer DEFAULT 5 NOT NULL,
	`participants_can_add` integer DEFAULT false NOT NULL,
	`cooldown_seconds` integer DEFAULT 0 NOT NULL,
	`dm_transcripts` integer DEFAULT true NOT NULL,
	`next_ticket_number` integer DEFAULT 1 NOT NULL,
	`link_request_message_id` text,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_servers_tag_unique` ON `client_servers` (`tag`);--> statement-breakpoint
CREATE TABLE `hub_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`log_channel_id` text,
	`transcript_channel_id` text,
	`closed_category_id` text,
	`staff_role_ids` text DEFAULT '[]' NOT NULL,
	`staff_identity` text DEFAULT 'named' NOT NULL,
	`note_prefix` text DEFAULT '//' NOT NULL,
	`auto_close_warn_hours` integer,
	`auto_close_close_hours` integer,
	`archive_mode` text DEFAULT 'delete' NOT NULL,
	`grace_minutes` integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_links` (
	`ticket_id` integer NOT NULL,
	`source_side` text NOT NULL,
	`source_message_id` text NOT NULL,
	`copy_index` integer DEFAULT 0 NOT NULL,
	`copy_message_id` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`source_message_id`, `copy_index`),
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_links_copy_idx` ON `message_links` (`copy_message_id`);--> statement-breakpoint
CREATE TABLE `ticket_participants` (
	`ticket_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`ticket_id`, `user_id`),
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_guild_id` text NOT NULL,
	`number` integer NOT NULL,
	`opener_id` text NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`client_channel_id` text,
	`client_webhook_id` text,
	`client_webhook_token` text,
	`client_starter_message_id` text,
	`hub_channel_id` text,
	`hub_webhook_id` text,
	`hub_webhook_token` text,
	`hub_starter_message_id` text,
	`claimed_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_opener_activity_at` integer,
	`last_staff_activity_at` integer,
	`auto_close_warned_at` integer,
	`closing_until` integer,
	`closed_at` integer,
	`closed_by` text,
	`close_reason` text,
	`last_relayed_client_message_id` text,
	`last_relayed_hub_message_id` text,
	FOREIGN KEY (`client_guild_id`) REFERENCES `client_servers`(`guild_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_client_number_idx` ON `tickets` (`client_guild_id`,`number`);--> statement-breakpoint
CREATE INDEX `tickets_client_channel_idx` ON `tickets` (`client_channel_id`);--> statement-breakpoint
CREATE INDEX `tickets_hub_channel_idx` ON `tickets` (`hub_channel_id`);--> statement-breakpoint
CREATE INDEX `tickets_opener_status_idx` ON `tickets` (`opener_id`,`status`);