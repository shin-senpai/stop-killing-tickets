# Architecture

This document is for developers. It tells how the code is organized and how the parts work together. For the product design, refer to [DESIGN.md](DESIGN.md).

## 1. Overview

The bot is one Node.js process. It uses discord.js 14 for the Discord gateway and REST API. It keeps all state in one SQLite file. The bot has no web server and no other external service.

The source code has three **feature modules** (`setup`, `tickets`, `relay`) and two shared layers (`core`, `db`). Each feature module gives its commands, components, and event listeners to the core through one contract (`BotModule`).

### Startup sequence

`src/index.ts` does these steps in this order:

1. Read the environment variables (`src/config.ts`). If a required variable is missing, the process stops with an error.
2. Apply the database migrations (`runMigrations()`).
3. Create the Discord client with the gateway intents and partials.
4. Make the interaction router and the command sync from the list of modules.
5. Call `register(client)` on each module. Modules attach their gateway event listeners here.
6. Log in to Discord.
7. When the client is ready, register the commands in each server.
8. Call `onReady(client)` on each module. If one module fails, the bot logs the error and continues with the next module.

The work at startup of each module:

| Module | Work at startup |
|---|---|
| `relay` | Queues the catch-up of missed messages. It uses its own `ClientReady` listener, not `onReady`, because the catch-up must start before any live message. |
| `setup` | Finds linked client servers that the bot is no longer in, sets them to `unlinked`, and force-closes their tickets. Updates each intake message to the current status. |
| `tickets` | Starts the scheduler. |

On `SIGINT` or `SIGTERM`, the bot closes the Discord connection and the database, and then stops.

### Gateway intents and partials

| Intent | Use |
|---|---|
| `Guilds` | Servers, channels, roles. |
| `GuildMessages` | Messages in the intake channels and ticket channels. |
| `MessageContent` (privileged) | The text of the messages. |
| `GuildMembers` (privileged) | Members who leave, account age, and join date. |

The bot also uses the partials `Message`, `Channel`, and `GuildMember`. With these partials, the bot receives edit and delete events for messages that were sent before a restart.

## 2. Module layout

```
src/
  index.ts          Startup, client, intents, event wiring, shutdown
  config.ts         Environment variables
  core/
    module.ts       BotModule, SlashCommand, ComponentHandler contracts
    router.ts       Interaction router
    customId.ts     Build and parse component custom IDs
    commandSync.ts  Command registration for each server
    hub.ts          isHubGuild, fetchHubGuild, sendHubLog
    staff.ts        isBotOwner, isServerAdmin, isClientStaff, isHubStaff
    staffLabel.ts   staffLabel: the name of a hub staff member in client notices
    staffIdentity.ts resolveStaffLabel: gets the member and the mode, then calls staffLabel
    limits.ts       Shared Discord limits
    serialQueue.ts  KeyedSerialQueue: jobs run one at a time for each key
    discordErrors.ts Checks for Discord API errors (unknown webhook, message, channel)
    permissions.ts  BOT_PERMISSIONS, ticket permission sets, missingBotPermissions
    errors.ts       UserFacingError
    notices.ts      sendTempNotice (a message that deletes itself)
    text.ts         truncate, chunkText, sanitizeWebhookUsername, padTicketNumber, toChannelSlug
    colors.ts       Embed colors
    logger.ts       Logger with LOG_LEVEL
  db/
    schema.ts       Drizzle table definitions (source of truth for the schema)
    index.ts        Connection, pragmas, runMigrations, closeDatabase
    queries.ts      Shared queries
  setup/
    commands/       /setup, /config, /blacklist (client and hub), /hub, /clients
    approval.ts     Approve and reject buttons, approve modal
    linking.ts      Status changes: approve, reject, pause, resume, unlink, removal
    intakeMessage.ts The instruction embed in the intake channel
    events.ts       Deleted servers, channels, and roles; startup check
  tickets/
    command.ts      /ticket
    intake.ts       Intake channel handler and validation
    create.ts       Ticket creation with rollback
    lifecycle.ts    Re-exports the public entry points of the files below
    close.ts        Close and reopen (closeTicket, reopenTicket)
    closeComponents.ts Close, close-with-reason, and reopen buttons and modal
    finalize.ts     End of the grace period, forced closes (forceCloseClientTickets)
    events.ts       Deleted ticket channels, members who leave
    notices.ts      Notices in the ticket channels
    noticeText.ts   Texts of the close and reopen notices
    channels.ts     Create, fetch, delete, and send to ticket channels
    scheduler.ts    The 60-second tick
    autoClose.ts    Auto-close decision (pure function)
    transcript.ts   HTML transcripts and their delivery
    ticketLock.ts   withTicketLock: one state change of a ticket at a time
    repo.ts         Ticket queries
    starterView.ts  Starter embeds and buttons
  relay/
    index.ts        Gateway listeners for create, edit, delete; the relay queue
    catchUp.ts      Catch-up after downtime
    identity.ts     Webhook names and avatars
    webhooks.ts     Create the ticket webhooks; send, edit, and delete through them
    channels.ts     Fetch ticket channels
    sides.ts        Helpers for the client side and the hub side of a ticket
drizzle/            Generated SQL migrations and drizzle-kit metadata
```

Rules for the layers:

- `core` and `db` do not import from the feature modules.
- A feature module can import from `core`, `db`, and from the exported functions of another feature module. For example, `setup` calls `forceCloseClientTickets` from `tickets/lifecycle.ts` when a hub admin unlinks a client server.
- The tree above shows the main files only. Each folder has more small files with one task each.
- Put shared logic that does not need Discord in `core/text.ts` or in a similar file. Pure functions are easy to test.

## 3. The BotModule contract

`src/core/module.ts` defines the contract. Each feature module exports one object of this type. `src/index.ts` keeps the list of modules.

```ts
interface BotModule {
  name: string;
  commands?: SlashCommand[];
  components?: ComponentHandler[];
  register?(client: Client): void;          // called once, before login
  onReady?(client: Client<true>): Promise<void>; // called once, after commands are registered
}
```

| Member | Use |
|---|---|
| `name` | A short name for logs. |
| `commands` | The slash commands of the module. |
| `components` | The handlers for buttons, select menus, and modals. |
| `register` | Attach gateway event listeners, for example `messageCreate`. Do not call the Discord API here. |
| `onReady` | Do startup work that needs the API, for example catch-up or the scheduler start. |

### Slash commands

```ts
interface SlashCommand {
  scope: 'hub' | 'client' | 'both';
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>): Promise<void>;
}
```

The `scope` controls where the command is registered:

| Scope | Registered in |
|---|---|
| `hub` | The hub server only. |
| `client` | Client servers only. Every server that is not the hub server is a client server. |
| `both` | All servers. |

The same command name can exist one time as `hub` and one time as `client`. For example, `/blacklist` can have one definition for client servers and a different definition for the hub server.

Use `default_member_permissions` in `data` to hide admin commands from normal members. Also do the permission check in `execute`, with the functions in `core/staff.ts`. Server admins can change the command permissions in Discord, thus the check in `execute` is necessary.

### Add a new module

1. Make a folder in `src/`, for example `src/stats/`.
2. Export a `BotModule` object from `src/stats/index.ts`.
3. Add the object to the `modules` array in `src/index.ts`.
4. Restart the bot. The command sync registers the new commands.

## 4. Interaction router

`src/core/router.ts` makes one function that handles all interactions. At startup, it puts all commands and component handlers into maps. A duplicate command (same scope and name) or a duplicate handler ID stops the startup with an error.

The router does these steps for each interaction:

1. Ignore the interaction if it is not from a cached server. The bot does not handle direct messages.
2. For a slash command, find the command by the scope of the server and the command name. Then try the `both` scope. Call `execute`.
3. For an autocomplete, find the command in the same way. Call `autocomplete` if it exists.
4. For a button, select menu, or modal, parse the custom ID. Find the handler by the handler ID. Call `handle` with the arguments.

Errors:

| Error | Result |
|---|---|
| `UserFacingError` | The router sends the error message to the user as an ephemeral reply. The router does not log it. |
| Any other error | The router logs the error. The user gets the ephemeral reply "Something went wrong. Try again." |
| No command found | The user gets "This command is not available in this server." |
| No handler found | The user gets "This button is no longer active." |

If the interaction already has a reply or a deferred reply, the router sends a follow-up message instead.

Throw a `UserFacingError` for all expected problems, for example a missing permission or a full ticket. Write the message for the user, not for the developer.

## 5. Custom IDs

`src/core/customId.ts` builds and parses the custom IDs of buttons, select menus, and modals.

The format is `<handlerId>:<arg>:<arg>`. For example, `customId('ticketClose', 42)` gives `ticketClose:42`. The router sends `['42']` as `args` to the handler with the ID `ticketClose`.

Rules:

- Arguments must not contain `:`.
- The full custom ID must have a maximum of 100 characters. `customId()` throws an error if the ID is longer.
- Each handler ID must be unique in the full bot. Keep the handler IDs of a module in one constant, for example `TicketComponentIds` in `src/tickets/ids.ts`.
- Put all necessary state in the custom ID or in the database. Do not keep it only in memory. Thus, buttons continue to work after a restart.

## 6. Command registration

`src/core/commandSync.ts` registers commands for each server, not globally. Thus, the hub server and the client servers can have different command sets. Also, changes apply immediately.

The bot registers commands at two times:

- At startup, in all servers that the bot is in (`syncAll`).
- When the bot joins a new server (`guildCreate` event, `syncGuild`).

`syncGuild` uses `guild.commands.set()`. This replaces the full command set of the server. Thus, a command that you remove from the code also goes away from Discord at the next start. There is no separate deploy step.

If the registration fails in one server, the bot logs the error and continues with the other servers.

## 7. Database and migrations

### Connection

`src/db/index.ts` opens the SQLite file at `DATABASE_PATH`. It creates the parent folder if necessary. It sets these pragmas:

- `journal_mode = WAL`
- `foreign_keys = ON`

`better-sqlite3` is synchronous. Thus, a query does not need `await`. Keep each query short, because a query stops the event loop while it runs.

`src/db/schema.ts` defines all tables with Drizzle. `src/db/queries.ts` has the queries that more than one module uses. Put a query that only one module uses in that module.

Data rules:

- Keep Discord objects by ID only. Never find a channel, role, or webhook by name.
- Keep timestamps as Unix milliseconds (`timestamp_ms` mode).
- `hub_config` has one row with `id = 1`. `getHubConfig()` creates it if it does not exist.

### Migrations

The bot applies migrations automatically at startup. The migrations are in the `drizzle/` folder. `runMigrations()` finds this folder from `src/db` (development) and from `dist/db` (production).

To change the schema, do these steps:

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate`.
3. Examine the new SQL file in `drizzle/`.
4. Commit the new SQL file and the changed files in `drizzle/meta/`.
5. Restart the bot. The bot applies the new migration.

CAUTION: Do not edit a migration file after you commit it. Servers that already applied the file do not apply it again.

CAUTION: Make a backup of the database before a migration that removes or changes columns. SQLite cannot undo a migration.

## 8. Relay design

The `relay` module copies messages between the client ticket channel and the hub ticket channel.

### Webhooks

Each ticket channel has its own webhook. The bot creates the two webhooks when it creates the ticket. The `tickets` table keeps the webhook ID and token of each side. The bot sends each relayed message through the webhook of the other side. The webhook sets the name and avatar of the author.

- `sanitizeWebhookUsername()` makes each name safe for Discord. It changes "discord" and "clyde", and it cuts the name to 80 characters.
- Each relayed message uses `allowedMentions: { parse: [] }`. Thus, a relayed message never pings.
- `chunkText()` splits text into parts of a maximum of 2,000 characters. It splits at a line break or a space where possible.

### Loop prevention

The relay ignores each message that has a `webhookId` and each message from the bot. All relayed messages come from the webhooks of the bot. Thus, the bot never relays a relayed message again.

The relay also ignores hub messages that start with the note prefix. These messages are internal notes.

### Message links

The `message_links` table connects each source message to its relayed copies. One source message can have more than one copy, one copy for each text part. `copy_index` is the number of the part.

The relay uses message links for these events:

| Event | Use of the message link |
|---|---|
| Edit | Find the copy and edit it through the webhook. |
| Delete | Find the copy and delete it through the webhook. |
| Reply | Find the copy of the original message on the other side. Add a quote line with a link to that copy. |

### Queue for each ticket

Each ticket has one queue (`KeyedSerialQueue` from `src/core/serialQueue.ts`, keyed by the ticket ID). The relay jobs of a ticket run one at a time, in the order that they arrive. Thus, the messages arrive on the other side in the correct order, also during rate limits. The jobs of different tickets run in parallel. discord.js handles the REST rate limits.

### Catch-up

The `tickets` table keeps the ID of the last relayed message from each side (`last_relayed_client_message_id`, `last_relayed_hub_message_id`). The relay updates these IDs after each relayed message.

When the client is ready, the relay queues one catch-up job for each `open` or `closing` ticket. These jobs go into the queue before any live message. The catch-up job does these steps:

1. Get the messages after the last relayed ID in each of the two ticket channels. The maximum is 500 messages for each channel.
2. Sort the messages of the two sides by ID.
3. Skip messages that arrived after the client became ready. The live events relay these messages.
4. Relay the other messages in order. Each of them gets the line `-# sent while the bridge was offline`.

### Edits and deletes

- The relay ignores an edit event if the text did not change. Discord sends these events when it adds a link preview.
- The relay handles single deletes and bulk deletes.
- An edit of a hub message that starts with the note prefix is not relayed.

## 9. Scheduler

The scheduler does time-based work:

- Delete or archive the channels when the grace period ends (`closing_until`).
- Send the auto-close warning and close inactive tickets (`last_opener_activity_at`, `last_staff_activity_at`, `auto_close_warned_at`).

`onReady` of the `tickets` module starts the scheduler (`startLifecycleScheduler`, exported from `src/tickets/lifecycle.ts`). The first tick runs immediately. Then a tick runs every 60 seconds. If a tick is still running, the next tick does not start.

At each tick, the scheduler reads the timestamps from the database and does the work that is due. Each ticket action runs under the lock for that ticket (`withTicketLock` in `src/tickets/ticketLock.ts`). The lock is a second `KeyedSerialQueue`, separate from the relay queue. Before the action, the scheduler reads the ticket again. Thus, a message from the opener that arrived in the meantime cancels an auto-close.

The database is the only source of the schedule. The scheduler does not keep timers in memory. Thus, a restart does not lose scheduled work. After a restart, the first tick does all work that became due during the downtime.

Each tick must be safe to run again. These rules apply:

- The scheduler saves the warning time before it sends the warning. Thus, a channel that fails does not get a new warning every minute.
- The bot marks a ticket `closed` also if a Discord call fails. Thus, the scheduler does not try a broken channel every minute. The bot sends an alert to the hub log channel instead.
- A failure in one ticket does not stop the work on the other tickets.

## 10. Staff names

The staff identity mode (`hub_config.staff_identity`) controls how hub staff show in client servers. Only two places make these names. Use them, and do not write names in a different place.

| File | Function | Result |
|---|---|---|
| `src/core/staffLabel.ts` | `staffLabel(mode, profile)` | The label in notices and in the client starter embed: `Bob`, `Support Team (Moderator)`, or `Support Team`. |
| `src/core/staffIdentity.ts` | `resolveStaffLabel(client, userId)` | Gets the hub member and the current mode, then calls `staffLabel`. |
| `src/relay/identity.ts` | `hubAuthorIdentity(mode, author)` | The webhook name of a relayed hub message: `Bob · Support`, `Support Team · Moderator`, or `Support Team` with the hub icon. |
| `src/relay/identity.ts` | `clientAuthorIdentity(author)` | The webhook name of a relayed client message: `Ana (Acme Gaming)`, or `Ana (Acme Gaming Staff)` for client staff. |

If the member has no role above @everyone, the `role` mode uses only `Support Team`. If the bot cannot find the member, `staffLabel` also returns `Support Team`.

## 11. Shared tools

| Tool | File | Use |
|---|---|---|
| `logger` | `core/logger.ts` | Write log lines. `LOG_LEVEL` sets the minimum level. |
| `sendHubLog` | `core/hub.ts` | Post to the hub log channel. It does nothing if no hub log channel is set. It never throws. |
| `sendTempNotice` | `core/notices.ts` | Post a message that deletes itself after 10 seconds. Use it where an ephemeral reply is not possible. |
| `missingBotPermissions` | `core/permissions.ts` | Get the names of the permissions that the bot does not have in a channel. |
| `isServerAdmin`, `isClientStaff`, `isHubStaff` | `core/staff.ts` | Permission checks. Users in `BOT_OWNER_IDS` always pass `isServerAdmin`. |

## 12. Code style

- Use TypeScript in strict mode. The compiler also uses `noUncheckedIndexedAccess`.
- Use ES modules. Write the `.js` extension in relative imports, for example `import { db } from './index.js'`.
- Run `npm run format` to format the code with Prettier (single quotes, line width 100).
- Write a comment only when it helps the reader. A good comment tells why the code does something, or it tells a rule that the code cannot show.
- Do not write narrative comments. For example, do not write "Now we fetch the channel", change history, or notes to other developers about the work.
- Write a short doc comment on exported contracts and on functions with behavior that is not clear from the name.
- Use the terms in [DESIGN.md](DESIGN.md) in names and in text: hub, client, opener, participant, intake.
- Write messages for users with "support team" and "ticket". Do not use "hub" or "client" in text that users see.

## 13. Tests and checks

| Command | Use |
|---|---|
| `npm test` | Run all tests with Vitest. |
| `npm run typecheck` | Run the TypeScript compiler with no output files. |
| `npm run build` | Compile `src/` to `dist/`. |

Put a test file next to the file that it tests, with the name `<name>.test.ts`. For example, `src/core/text.test.ts` tests `src/core/text.ts`. The build does not include test files.

Do these checks before you commit a change:

1. Run `npm run typecheck`.
2. Run `npm test`.
3. Run `npm run format`.
