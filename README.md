# Stop Killing Tickets

Stop Killing Tickets is a Discord bot that connects support tickets from many community servers to one staff server.

A user types a message in a community server. The bot changes the message into a private ticket channel in that server. The bot also creates a linked ticket channel in the central staff server. The bot copies the messages between the two channels. The support team answers from one server, and the user does not leave the community server.

## Terminology

The documentation uses these terms. Use each term only with this description.

| Term | Description |
|---|---|
| **Hub server** | The one central server where the support team works. |
| **Client server** | A community server where users open tickets. There can be any number of client servers. |
| **Intake channel** | The channel in a client server where users type a message to open a ticket. |
| **Ticket** | Two linked ticket channels: one in the client server and one in the hub server. |
| **Ticket channel** | One of the two channels of a ticket. The **client ticket channel** is in the client server. The **hub ticket channel** is in the hub server. |
| **Opener** | The user who opened the ticket. |
| **Participant** | A user who is not staff and who the opener added to the ticket. |
| **Staff role** | A role that gives access to tickets. A **client staff role** is in a client server. A **hub staff role** is in the hub server. |
| **Client staff** | Members of a client server with a client staff role or the Manage Server permission. They can see, moderate, and reply in tickets. |
| **Hub staff** | Hub server admins and members with a hub staff role. If no hub staff role is set, all members who can see the hub ticket channel. |
| **Tag** | A short code for each client server, for example `acme`. Hub ticket channels use the tag in the name: `acme-0042`. |
| **Hub log channel** | The channel in the hub server for alerts and link requests. |
| **Transcript channel** | The channel in the hub server for full transcripts. |

## Features

- One hub server for the tickets of all client servers.
- Users open a ticket with a normal message in the intake channel.
- Messages, files, edits, deletes, and replies go in the two directions.
- The bot relays messages only while a ticket is open. It does not relay messages in the reopen grace period.
- Any member of a client server can open a ticket, including client staff.
- Mentions never ping across servers.
- Client staff can see and reply in the tickets of their server.
- Optional hub staff roles limit who can claim, close, and write notes in the hub server.
- Hub admins control access with normal Discord category permissions.
- Each client server connects only after a hub admin approves it with a tag and a hub category.
- The opener and client staff can add and remove participants in the client server.
- Hub staff can claim and transfer tickets and write internal notes that the user does not see.
- Three staff identity modes: `named`, `anonymous`, and `role`.
- HTML transcripts go to the hub server, to the client log channel, and to the opener by DM.
- A reopen grace period after each close. In the hub server, closed channels can be deleted or moved to an archive category.
- Optional automatic close after a period with no activity.
- A blacklist for each client server and a global blacklist.
- Catch-up after downtime: the bot relays messages that users sent while the bot was offline.
- Overflow categories when a category has 50 channels, and an alert when the hub server has 450 channels.
- Automatic database migrations and command registration at startup.

## Quick start

You need Node.js 22.12 or later and a Discord bot application.

1. Create the bot in the Discord Developer Portal. Refer to the [setup guide](docs/setup-guide.md).
2. Turn on the privileged intents **Server Members Intent** and **Message Content Intent**.
3. Install the dependencies:

   ```sh
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Set `DISCORD_TOKEN` and `HUB_GUILD_ID` in `.env`.
6. Start the bot:

   ```sh
   npm run dev
   ```

7. Invite the bot to the hub server.
8. In the hub server, run `/hub setup`.
9. Invite the bot to a client server.
10. In the client server, run `/setup`.
11. In the hub log channel, approve the link request.

For production, systemd, Docker, and backups, refer to the [setup guide](docs/setup-guide.md).

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start the bot in development. The bot restarts when a file changes. |
| `npm run build` | Compile the TypeScript files to `dist/`. |
| `npm start` | Start the compiled bot from `dist/`. |
| `npm test` | Run the tests. |
| `npm run typecheck` | Do a type check with no output files. |
| `npm run format` | Format the code with Prettier. |
| `npm run db:generate` | Make a new database migration from `src/db/schema.ts`. |

## Documentation

| Document | Readers | Content |
|---|---|---|
| [docs/setup-guide.md](docs/setup-guide.md) | Bot host, hub admins | Install, run, back up, and update the bot. First-time configuration. |
| [docs/user-guide.md](docs/user-guide.md) | Members of client servers | Open, use, and close a ticket. |
| [docs/admin-guide.md](docs/admin-guide.md) | Client server admins, hub admins | Command reference, common tasks, and problems. |
| [docs/DESIGN.md](docs/DESIGN.md) | Developers | Design specification. |
| [docs/architecture.md](docs/architecture.md) | Developers | Code structure, modules, database, relay, scheduler, code style, tests. |

## Project layout

```
src/
  index.ts       Startup, Discord client, event wiring
  config.ts      Environment variables
  core/          Module contract, interaction router, custom IDs, command sync, shared tools
  db/            Database schema, connection, migrations, queries
  setup/         Server setup, link requests, configuration commands
  tickets/       Intake, ticket channels, participants, close, reopen, transcripts, scheduler
  relay/         Message relay between client ticket channels and hub ticket channels
drizzle/         Generated SQL migrations
docs/            Documentation
.env.example     Example environment file
```

## Technology

- TypeScript
- Node.js 22.12 or later
- discord.js 14
- SQLite with `better-sqlite3` and Drizzle ORM
- `discord-html-transcripts`
- Vitest

## License

License: to be decided.
