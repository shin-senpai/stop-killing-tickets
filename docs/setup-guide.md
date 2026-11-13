# Setup Guide

This guide tells you how to install, start, and configure the bot. It is for the person who hosts the bot and for the hub admins.

For the terms in this guide (hub server, client server, intake channel), refer to the [README](../README.md#terminology). For the command reference, refer to the [admin guide](admin-guide.md).

## Contents

1. [Requirements](#1-requirements)
2. [Create the Discord application and bot](#2-create-the-discord-application-and-bot)
3. [Turn on the privileged intents](#3-turn-on-the-privileged-intents)
4. [Make the invite link](#4-make-the-invite-link)
5. [Install the bot](#5-install-the-bot)
6. [Set up the .env file](#6-set-up-the-env-file)
7. [Run the bot in development](#7-run-the-bot-in-development)
8. [Build and run the bot in production](#8-build-and-run-the-bot-in-production)
9. [Run the bot with systemd](#9-run-the-bot-with-systemd)
10. [Run the bot with Docker](#10-run-the-bot-with-docker)
11. [Back up the database](#11-back-up-the-database)
12. [Update the bot](#12-update-the-bot)
13. [First-time configuration](#13-first-time-configuration)
14. [Solve problems](#14-solve-problems)

## 1. Requirements

| Item | Requirement |
|---|---|
| Node.js | Version 24.21.0. The file `.nvmrc` has this version. |
| npm | The version that comes with Node.js. |
| Build tools | Python 3, `make`, and a C++ compiler. `better-sqlite3` needs these tools only if no prebuilt binary is available for your system. |
| Disk | A persistent folder for the SQLite database file. |
| Discord | An account that can create applications. You must have the Manage Server permission in the hub server. |

## 2. Create the Discord application and bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**.
3. Type a name for the application.
4. Click **Create**.
5. On the **General Information** page, copy the **Application ID**. You use it in section 4.
6. Click **Bot** in the menu.
7. Click **Reset Token**.
8. Copy the token. You use it in the `.env` file (section 6).
9. Make sure that **Requires OAuth2 Code Grant** is off.

WARNING: Do not share the bot token. A person with the token has full control of the bot.

The **Public Bot** setting controls who can invite the bot. If it is on, all client server admins can invite the bot themselves. A server that a hub admin did not approve stays `pending` and cannot open tickets. Thus, you can keep **Public Bot** on.

## 3. Turn on the privileged intents

The bot needs two privileged gateway intents. Without them, the login fails.

1. In the Developer Portal, open your application.
2. Click **Bot** in the menu.
3. Find the **Privileged Gateway Intents** section.
4. Turn on **Server Members Intent**.
5. Turn on **Message Content Intent**.
6. Click **Save Changes**.

The bot uses Server Members Intent to find members who leave and to show account and join dates. The bot uses Message Content Intent to read the text of tickets and to relay messages.

NOTE: When the bot is in more than 100 servers, Discord requires verification of the bot. Without verification, the bot cannot use the privileged intents.

## 4. Make the invite link

The bot role needs these server-wide permissions in each server. The list comes from `BOT_SERVER_PERMISSIONS` in `src/core/permissions.ts`. The bot does not need Administrator or other permissions. The bot shows a warning only when a permission from this list is missing.

| Permission | Use |
|---|---|
| View Channels | See the intake channel, ticket channels, and categories. |
| Manage Channels | Create, rename, move, and delete ticket channels and categories. |
| Manage Roles | Set the permission overwrites of ticket channels. Discord shows it as Manage Permissions on channels. |
| Manage Webhooks | Create and delete the webhook of each ticket channel. |
| Send Messages | Post starter messages, notices, and transcripts. |
| Embed Links | Post embeds. |
| Attach Files | Upload attachments and transcripts. |
| Read Message History | Read messages for catch-up and transcripts. |
| Manage Messages | Delete intake messages and the pin notices. |
| Pin Messages | Pin the intake message and the starter messages. Discord moved pinning out of Manage Messages into this permission. |
| Add Reactions | Mark internal notes with the 🔒 reaction. |

The permission integer for this list is `2251800619117648`.

NOTE: Discord lets a bot set permission overwrites on a new channel only for the permissions that the bot has in the server. Permissions on a category do not count. Thus, the bot role must have these permissions server-wide. The scopes are `bot` and `applications.commands`.

TIP: When the bot is in the hub server, run `/hub invite` in the hub server. The bot shows the full invite link with the correct permissions.

Use one of these two methods to make the invite link.

**Method A: write the link yourself.**

1. Copy this link:

   ```
   https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot%20applications.commands&permissions=2251800619117648
   ```

2. Replace `APPLICATION_ID` with the Application ID from section 2.

**Method B: use the URL Generator.**

1. In the Developer Portal, click **OAuth2** in the menu.
2. Find the **OAuth2 URL Generator** section.
3. Select the scopes `bot` and `applications.commands`.
4. In **Bot Permissions**, select the eleven permissions in the table above.
5. Copy the generated URL at the bottom of the page.

Use the same invite link for the hub server and for all client servers.

## 5. Install the bot

1. Copy the project files to the host. For example, clone the repository:

   ```sh
   git clone <repository-url> stop-killing-tickets
   cd stop-killing-tickets
   ```

2. Install the dependencies:

   ```sh
   npm ci
   ```

If `npm ci` fails on `better-sqlite3`, install the build tools from section 1. Run `npm ci` again.

## 6. Set up the .env file

The bot reads its settings from environment variables. In development and with `npm start`, the bot reads them from the `.env` file in the project folder.

1. Copy the example file:

   ```sh
   cp .env.example .env
   ```

2. Open `.env` in a text editor.
3. Set the variables in the table below.
4. Save the file.
5. Make the file readable only by your user:

   ```sh
   chmod 600 .env
   ```

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | Yes | None | The bot token from section 2. |
| `HUB_GUILD_ID` | Yes | None | The ID of the hub server. There is only one hub server. |
| `BOT_OWNER_IDS` | No | Empty | User IDs, separated by commas. These users can always use admin commands in all servers. |
| `DATABASE_PATH` | No | `./data/bot.sqlite` | The path of the SQLite database file. A relative path starts at the folder where you start the bot. The bot creates the folder if it does not exist. |
| `LOG_LEVEL` | No | `info` | The minimum log level: `debug`, `info`, `warn`, or `error`. |

The bot creates the database folder with the mode `0700` and sets the database file to the mode `0600`. The database has the webhook tokens of all tickets. Thus, only the user that runs the bot must read it.

Example:

```ini
DISCORD_TOKEN=your-bot-token
HUB_GUILD_ID=123456789012345678
BOT_OWNER_IDS=111111111111111111,222222222222222222
DATABASE_PATH=./data/bot.sqlite
LOG_LEVEL=info
```

To get a server ID or a user ID, do these steps:

1. In Discord, open **User Settings**.
2. Click **Advanced**.
3. Turn on **Developer Mode**.
4. Right-click the server icon.
5. Click **Copy Server ID**.

To get a user ID, right-click the user. Then click **Copy User ID**.

WARNING: Do not commit the `.env` file. The file has the bot token. The `.gitignore` file already excludes `.env`.

CAUTION: Set `HUB_GUILD_ID` correctly before the first start. The bot registers the hub commands only in this server.

## 7. Run the bot in development

1. Make sure that the `.env` file is complete.
2. Start the bot:

   ```sh
   npm run dev
   ```

The bot starts with `tsx` and runs the TypeScript files directly. When you save a file in `src/`, the bot restarts automatically.

At startup, the bot applies the database migrations. Then it registers the commands in each server. You do not need a separate deploy step for commands.

When the start is successful, the log shows `Logged in as <bot name> in <number> servers`.

To stop the bot, push **Ctrl+C**.

## 8. Build and run the bot in production

1. Install the dependencies:

   ```sh
   npm ci
   ```

2. Compile the TypeScript files to `dist/`:

   ```sh
   npm run build
   ```

3. Start the bot:

   ```sh
   npm start
   ```

`npm start` runs `node --env-file-if-exists=.env dist/index.js`. Run it from the project folder, because the bot reads `.env` from the current folder.

The bot reads the migrations from the `drizzle/` folder. Keep `drizzle/` next to `dist/`.

`npm start` does not restart the bot after a crash or a reboot. For a server, use systemd (section 9) or Docker (section 10).

## 9. Run the bot with systemd

Use this method on a Linux server with systemd. The example uses the folder `/opt/stop-killing-tickets` and the user `ticketbot`.

1. Create a system user for the bot:

   ```sh
   sudo useradd --system --home /opt/stop-killing-tickets --shell /usr/sbin/nologin ticketbot
   ```

2. Copy the project files to `/opt/stop-killing-tickets`.
3. Create the `.env` file (section 6).
4. Give the files to the user:

   ```sh
   sudo chown -R ticketbot:ticketbot /opt/stop-killing-tickets
   ```

5. As the bot user, install, build, and create the database folder:

   ```sh
   cd /opt/stop-killing-tickets
   sudo -u ticketbot npm ci
   sudo -u ticketbot npm run build
   sudo -u ticketbot mkdir -p data
   ```

6. Find the path of Node.js:

   ```sh
   command -v node
   ```

7. Create the file `/etc/systemd/system/stop-killing-tickets.service` with the content below.
8. If the path from step 6 is not `/usr/bin/node`, change `ExecStart` to that path.
9. Load the new unit:

   ```sh
   sudo systemctl daemon-reload
   ```

10. Start the bot and start it automatically at boot:

    ```sh
    sudo systemctl enable --now stop-killing-tickets
    ```

11. Examine the log:

    ```sh
    journalctl -u stop-killing-tickets -f
    ```

Sample unit file:

```ini
[Unit]
Description=Stop Killing Tickets Discord bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ticketbot
Group=ticketbot
WorkingDirectory=/opt/stop-killing-tickets
ExecStart=/usr/bin/node --env-file=.env dist/index.js
Restart=on-failure
RestartSec=5
# New files (the database) are readable only by the bot user.
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/stop-killing-tickets/data

[Install]
WantedBy=multi-user.target
```

`ReadWritePaths` must contain the folder of `DATABASE_PATH`. If you change `DATABASE_PATH`, change `ReadWritePaths` also.

To stop the bot, run `sudo systemctl stop stop-killing-tickets`. The bot closes the Discord connection and the database before it stops.

## 10. Run the bot with Docker

Use this method if you use Docker and Docker Compose. Create the three files below in the project folder.

**Dockerfile**

```dockerfile
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
# Build tools for better-sqlite3 if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
RUN mkdir -p /app/data && chown node:node /app/data
USER node
CMD ["node", "dist/index.js"]
```

**.dockerignore**

```
node_modules
dist
data
.env
*.sqlite
*.sqlite-*
```

**compose.yaml**

```yaml
services:
  bot:
    build: .
    container_name: stop-killing-tickets
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_PATH: /app/data/bot.sqlite
    volumes:
      - ./data:/app/data
```

The volume keeps the database file in the `data/` folder on the host. The value of `DATABASE_PATH` in `compose.yaml` replaces the value in `.env`.

Do these steps to start the bot:

1. Create the `.env` file (section 6).
2. Create the `data/` folder:

   ```sh
   mkdir -p data
   ```

3. Give the folder to the user ID of the container (`node`, ID 1000):

   ```sh
   sudo chown 1000:1000 data
   ```

4. Build the image and start the container:

   ```sh
   docker compose up -d --build
   ```

5. Examine the log:

   ```sh
   docker compose logs -f bot
   ```

To stop the bot, run `docker compose down`. The database stays in `data/`.

CAUTION: Do not remove the `volumes` entry. Without the volume, the database is lost when you remove the container.

## 11. Back up the database

The database has all settings, all tickets, and the webhook tokens. Make a backup regularly and before each update.

The bot protects the database because of the webhook tokens. When the bot creates the database folder, it gives the folder the mode `0700`. At each start, it sets the mode of the database file to `0600`. Thus, only the user that runs the bot can read the database.

The database uses WAL mode. Thus, it can have up to three files: `bot.sqlite`, `bot.sqlite-wal`, and `bot.sqlite-shm`.

**Method A: back up while the bot runs.** This method needs the `sqlite3` command-line tool.

1. Create a folder for the backups:

   ```sh
   mkdir -p backups
   chmod 700 backups
   ```

2. Make the backup:

   ```sh
   sqlite3 data/bot.sqlite ".backup 'backups/bot-$(date +%F).sqlite'"
   ```

The `.backup` command makes one complete file. It is safe while the bot writes to the database.

**Method B: back up while the bot is stopped.**

1. Stop the bot.
2. Copy all database files:

   ```sh
   cp data/bot.sqlite* backups/
   ```

3. Start the bot.

To restore a backup, do these steps:

1. Stop the bot.
2. Move the current `bot.sqlite`, `bot.sqlite-wal`, and `bot.sqlite-shm` files to a different folder.
3. Copy the backup file to the path in `DATABASE_PATH`.
4. Start the bot.

WARNING: Keep the backup files private. They have the webhook tokens, and a person with a token can post in that ticket channel.

CAUTION: Do not copy only `bot.sqlite` while the bot runs. The copy can be incomplete, because recent changes can be in `bot.sqlite-wal`.

## 12. Update the bot

1. Back up the database (section 11).
2. Get the new version of the code. For example:

   ```sh
   git pull
   ```

3. Install the dependencies:

   ```sh
   npm ci
   ```

4. Build the code:

   ```sh
   npm run build
   ```

5. Restart the bot.

For step 5, use the command for your setup:

| Setup | Command |
|---|---|
| systemd | `sudo systemctl restart stop-killing-tickets` |
| Docker | `docker compose up -d --build` (this command also does steps 3 and 4) |
| Manual | Stop the bot. Run `npm start`. |

At startup, the bot applies new database migrations automatically. It also registers the new command set in each server. Messages that users sent during the update are relayed after the start.

## 13. First-time configuration

Do the hub server configuration first. Then connect the client servers. A client server cannot send a link request before the hub log channel is set.

The admin commands need the Manage Server permission. Users in `BOT_OWNER_IDS` can always use them. For all options of each command, refer to the [admin guide](admin-guide.md).

### 13.1 Configure the hub server

1. Open the invite link (section 4).
2. Select the hub server.
3. Click **Authorize**.
4. Make sure that the server ID of this server is the same as `HUB_GUILD_ID`.
5. Start the bot, if it does not run.
6. Make sure that the log does not show `The bot is not in the hub server`.
7. In the hub server, run `/hub setup`.
8. Read the reply. It shows the hub log channel and the transcript channel.
9. Give your staff role access to these two channels.
10. Create a category for the hub ticket channels. You can use one category for each client server or one category for many client servers.
11. In the permissions of this category, allow your staff role to see the category.
12. In the permissions of this category, give the bot role the permissions in the table below.
13. Optional: run `/hub staff-roles add <role>` for each staff role.

If you do not set the options of `/hub setup`, the bot creates `#ticket-log` and `#ticket-transcripts`. The bot hides these channels from @everyone. To use channels that exist, set the options `log-channel` and `transcript-channel`.

Permissions for the bot role in each hub category:

| Permission |
|---|
| View Channels |
| Manage Channels |
| Manage Webhooks |
| Send Messages |
| Embed Links |
| Attach Files |
| Read Message History |
| Manage Messages |
| Add Reactions |

The bot does not need Manage Permissions in the category. Its server-wide Manage Roles permission is sufficient.

CAUTION: Do not let normal members see the transcript channel. The full transcripts contain the internal notes of the staff.

Hub ticket channels copy their permissions from the category. Thus, the category permissions control which hub staff see the tickets of a client server.

If you set no hub staff roles, all members who can see a hub ticket channel are hub staff. If you set hub staff roles, only members with these roles and hub server admins are hub staff.

### 13.2 Connect a client server

A client server admin does steps 1 to 6. A hub admin does steps 7 to 11.

1. Open the invite link (section 4).
2. Select the client server.
3. Click **Authorize**.
4. In the client server, run `/setup`. All options are optional.
5. Read the reply. It shows the settings and the missing permissions.
6. If the reply shows missing permissions, give the bot these permissions.
7. In the hub log channel, find the link request "New server wants to connect".
8. Click **Approve**.
9. In the **Tag** field, accept the suggested tag or type a short tag, for example `acme`.
10. In **Hub category**, select the category for this client server.
11. Submit the form.

If you do not set the options of `/setup`, the bot creates the category `Tickets` and the channel `#open-a-ticket`. To use a category or channel that exists, set the options `category` and `intake-channel`. You can also set one client staff role (`staff-role`) and a client log channel (`log-channel`).

The client server status changes to `active`. The instruction message in the intake channel changes to the live instructions. Users can now open tickets.

A hub admin can also approve with the command `/clients approve <server> <tag> <category>`. To refuse a server, click **Reject** or run `/clients reject <server>`.

### 13.3 Test the setup

1. In the client server, use an account that is not client staff.
2. In the intake channel, type a message with a minimum of 10 characters.
3. Make sure that a ticket channel opens in the client server.
4. Make sure that a ticket channel with the tag (for example `acme-0001`) opens in the hub server.
5. In the hub ticket channel, send a reply.
6. Make sure that the reply shows in the client ticket channel.
7. Click **Close** in a ticket channel.
8. Click **Close** again to confirm.

NOTE: Any member can open a ticket, including client staff and admins. Thus, you can use an admin account for the test.

## 14. Solve problems

| Problem | Cause and action |
|---|---|
| The bot stops with `Missing required environment variable`. | The `.env` file is missing, or a required variable is empty. Do section 6 again. |
| The bot stops with `LOG_LEVEL must be one of`. | Set `LOG_LEVEL` to `debug`, `info`, `warn`, or `error`. |
| The login fails with an error about disallowed intents. | Turn on the privileged intents (section 3). |
| The log shows `The bot is not in the hub server`. | Invite the bot to the hub server, or correct `HUB_GUILD_ID`. |
| The commands do not show in Discord. | Make sure that the invite link has the `applications.commands` scope. Then reload Discord with **Ctrl+R**. Look for `Failed to register commands` in the log. |
| `npm ci` fails on `better-sqlite3`. | Make sure that Node.js is version 24.21.0 (see `.nvmrc`). Install the build tools from section 1. |
| The reply of `/setup` shows "I couldn’t reach the support team". | The hub log channel is not set. Run `/hub setup` in the hub server. Then run `/setup` in the client server again. |
| Messages in the intake channel do not open tickets. | Make sure that the client server is `active`. Make sure that the test account is not client staff. Run `/config check`. |
| The bot cannot create a ticket channel. | The category can be full, or the bot can have missing permissions. Run `/config check`. Look at the alerts in the hub log channel. |

For more detail in the log, set `LOG_LEVEL=debug` and restart the bot.
