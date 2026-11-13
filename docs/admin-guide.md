# Admin Guide

This guide is the command reference for client server admins and hub admins. It also gives procedures for common tasks and tells you how to solve problems.

For installation and the first configuration, refer to the [setup guide](setup-guide.md). For the terms in this guide, refer to the [README](../README.md#terminology).

## Contents

1. [Who can use the commands](#1-who-can-use-the-commands)
2. [Client server admin commands](#2-client-server-admin-commands)
3. [Hub admin commands](#3-hub-admin-commands)
4. [Ticket commands and buttons](#4-ticket-commands-and-buttons)
5. [Common tasks](#5-common-tasks)
6. [Solve problems](#6-solve-problems)

In the command syntax, `<option>` is a required option and `[option]` is an optional option.

## 1. Who can use the commands

| Command | Server | Who can use it |
|---|---|---|
| `/setup`, `/config`, `/blacklist` | Client server | Members with the Manage Server permission. |
| `/hub`, `/clients`, `/blacklist` | Hub server | Members of the hub server with the Manage Server permission. |
| `/ticket` | Client server and hub server | Depends on the subcommand. Refer to section 4. |

Users in `BOT_OWNER_IDS` (in the `.env` file) can always use the admin commands.

The bot registers the hub commands only in the hub server. It registers the client server commands only in client servers. `/blacklist` has a different version in each type of server.

The admin commands have the default permission Manage Server. Thus, Discord shows them only to members with this permission. You can change the command permissions in **Server Settings** > **Integrations**. The bot also does its own check. Thus, a member without Manage Server cannot use an admin command, also if Discord shows it.

The bot sends all replies to admin commands as ephemeral messages. Only you can see them.

## 2. Client server admin commands

Use these commands in a client server.

### 2.1 /setup

```
/setup [category] [intake-channel] [staff-role] [log-channel]
```

Sets up tickets in the server and sends a link request to the hub server.

| Option | Type | Description |
|---|---|---|
| `category` | Category | The ticket category. If you do not set it, the bot uses the saved category or creates the category `Tickets`. |
| `intake-channel` | Text channel | The intake channel. If you do not set it, the bot uses the saved channel or creates `#open-a-ticket`. |
| `staff-role` | Role | Adds one client staff role. To add more roles, use `/config staff-roles add`. |
| `log-channel` | Text channel | The client log channel. It receives transcripts and connection notices. |

The bot does these steps:

1. It prepares the ticket category. It hides the category from @everyone and gives itself the necessary permissions.
2. It posts and pins the instruction message in the intake channel.
3. It saves the settings. A new server gets the status `pending`.
4. It sends a link request to the hub log channel, if there is no open link request.
5. It shows the settings and a list of missing permissions.

You can run `/setup` again at any time. The bot keeps the settings that you do not change. If the server was `unlinked`, `/setup` sets it to `pending` again and sends a new link request.

### 2.2 /config

| Command | Description |
|---|---|
| `/config view` | Shows all settings and the status of the server. |
| `/config intake-channel <channel>` | Moves the intake channel. The bot deletes the old instruction message and posts a new one. |
| `/config category <category>` | Sets the ticket category for new tickets. The bot hides the category from @everyone. |
| `/config staff-roles add <role>` | Adds a client staff role. The bot also gives the role access to the open tickets. |
| `/config staff-roles remove <role>` | Removes a client staff role. The bot also removes the access of the role from the open tickets. |
| `/config staff-roles list` | Shows the client staff roles. |
| `/config log-channel [channel]` | Sets the client log channel. If you do not set `channel`, the bot turns off the log. |
| `/config intake-message` | Opens a form to edit the pinned instruction text in the intake channel. |
| `/config intake-post` | Opens a form with one text field. The bot posts the text as an embed in the intake channel. |
| `/config limits [options]` | Changes the ticket limits. If you do not set an option, the bot shows the current limits. |
| `/config dm-transcripts <enabled>` | Turns the transcripts by DM to the opener on or off. |
| `/config check` | Does a health check of the channels, permissions, and staff roles. |

You cannot use @everyone or a role that belongs to an app as a staff role. If you delete a staff role in Discord, the bot removes it from the list automatically.

The instruction text can have a maximum of 4,000 characters. To use the default text again, clear the field and submit the form.

`/config intake-message` changes the pinned instruction embed. `/config intake-post` adds a new embed and does not change the pinned embed. The text of `/config intake-post` can have a maximum of 4,000 characters. Mentions in the text do not ping. A post from `/config intake-post` never opens a ticket. To delete a post, use the Manage Messages permission.

The options of `/config limits`:

| Option | Default | Range | Description |
|---|---|---|---|
| `max-open-tickets` | 1 | 1 to 10 | The number of open tickets that one user can have. |
| `min-subject-length` | 10 | 0 to 1,000 | The minimum number of characters in the first message. |
| `max-participants` | 5 | 0 to 25 | The number of participants that the opener can add to one ticket. |
| `participants-can-add` | false | true or false | If true, participants can also add and remove people. |
| `cooldown-seconds` | 0 | 0 to 604,800 | The time in seconds that a user must wait before a new ticket. The time starts when the last ticket of the user closes, not at the end of the grace period. |

The default instruction text shows the value of `min-subject-length`. Thus, the bot updates the instruction message when you change the limits.

### 2.3 /blacklist (client server)

| Command | Description |
|---|---|
| `/blacklist add <user> [reason]` | Blocks a user from tickets in this server. The reason can have a maximum of 200 characters. |
| `/blacklist remove <user>` | Removes the block. |
| `/blacklist list` | Shows the blocked users of this server. |

A blocked user cannot open a ticket in the server. Nobody can add a blocked user to a ticket as a participant. The block does not close the open tickets of the user.

## 3. Hub admin commands

Use these commands in the hub server.

### 3.1 /hub

| Command | Description |
|---|---|
| `/hub invite` | Shows the invite link of the bot. Only you can see the reply. Use the link to add the bot to a client server. |
| `/hub setup [log-channel] [transcript-channel]` | Sets the hub log channel and the transcript channel. If you do not set a channel, the bot uses the saved channel or creates `#ticket-log` and `#ticket-transcripts`. |
| `/hub config view` | Shows all hub settings. |
| `/hub config staff-identity <mode>` | Sets how the names of hub staff show to users. Refer to the table below. |
| `/hub config note-prefix <prefix>` | Sets the note prefix. The prefix can have a maximum of 10 characters. |
| `/hub config auto-close <warn-hours> <close-hours>` | Turns on auto-close. Each value is from 1 to 720 hours. |
| `/hub config auto-close-off` | Turns off auto-close. |
| `/hub config archive-mode <mode> [closed-category]` | Sets what occurs to the hub ticket channel at the end of the grace period. |
| `/hub config grace-period <minutes>` | Sets the grace period, from 0 to 1,440 minutes. |
| `/hub staff-roles add <role>` | Adds a hub staff role. |
| `/hub staff-roles remove <role>` | Removes a hub staff role. |
| `/hub staff-roles list` | Shows the hub staff roles. |

The bot creates `#ticket-log` and `#ticket-transcripts` hidden from @everyone. Give your staff role access to these channels if necessary.

**Staff identity modes.** The mode changes the names that users see in the client server.

| Mode | Name on relayed messages | Name in notices, for example "… is now helping you" |
|---|---|---|
| `named` (default) | `Bob · Support` | `Bob` |
| `anonymous` | `Support Team`, with the icon of the hub server | `Support Team` |
| `role` | `Support Team · Moderator` (the highest role of the staff member) | `Support Team (Moderator)` |

If the staff member has no role, the `role` mode shows only `Support Team`.

**Note prefix.** The bot does not relay a hub message that starts with the note prefix. The default prefix is `//`. The bot adds the 🔒 reaction to these messages.

**Auto-close.** After a staff reply, the bot waits `warn-hours`. If the opener does not reply, the bot asks the opener if the problem is solved. If the opener does not reply in the next `close-hours`, the bot closes the ticket with the reason "Inactivity". Each message from the opener stops the countdown.

**Archive modes.**

| Mode | Result at the end of the grace period |
|---|---|
| `delete` (default) | The bot deletes the hub ticket channel. |
| `move` | The bot moves the hub ticket channel to the closed category. If you do not set `closed-category`, the bot uses the saved category or creates `Closed Tickets`. |

The bot always deletes the client ticket channel at the end of the grace period.

CAUTION: In `move` mode, the archived channels count toward the limit of 500 channels in the hub server. Delete old archived channels regularly.

**Grace period.** The default is 10 minutes. If you set 0, the bot removes closed tickets at the next scheduler run (within one minute). Then nobody can reopen them.

**Hub staff roles.** If you set one or more hub staff roles, only members with these roles and hub server admins are hub staff. If you set no hub staff roles, all members who can see the hub ticket channel are hub staff.

### 3.2 /clients

The `server` option shows a list of the client servers. You can also type the server ID or the tag.

| Command | Description |
|---|---|
| `/clients list` | Shows all client servers with the tag, status, hub category, and number of open tickets. |
| `/clients approve <server> <tag> <category>` | Connects a `pending` server. It does the same as the **Approve** button on the link request. An `unlinked` server must run `/setup` again before you can approve it. |
| `/clients reject <server>` | Refuses a `pending` server. It does the same as the **Reject** button. |
| `/clients set-category <server> <category>` | Sets a different hub category. Only new tickets use it. Open tickets stay in their category. |
| `/clients set-tag <server> <tag>` | Sets a different tag. Only new tickets use it. Open hub ticket channels keep their names. |
| `/clients pause <server> [message]` | Stops new tickets. The message can have a maximum of 500 characters. Users see it in the intake channel. |
| `/clients resume <server>` | Starts new tickets again. |
| `/clients unlink <server>` | Disconnects the server and closes all its tickets. The bot asks for confirmation. |

**Tag rules.** A tag has 2 to 16 characters. Use only lowercase letters, numbers, and `-`. Each client server must have a different tag. The approval form suggests a tag from the server name.

**Status changes.**

| Command | Status before | Status after |
|---|---|---|
| `/clients approve` | `pending` | `active` |
| `/clients reject` | `pending` | `unlinked` |
| `/clients pause` | `active` or `paused` | `paused` |
| `/clients resume` | `paused` | `active` |
| `/clients unlink` | `pending`, `active`, or `paused` | `unlinked` |

At each status change, the bot updates the instruction message in the intake channel. The bot also posts a notice in the client log channel, if one is set.

WARNING: Make sure that you select the correct server before you confirm `/clients unlink`. The bot closes all open tickets of the server immediately, with no grace period.

### 3.3 /blacklist (hub server)

| Command | Description |
|---|---|
| `/blacklist add <user-id> [reason]` | Blocks a user in all client servers. The reason can have a maximum of 200 characters. |
| `/blacklist remove <user-id>` | Removes the global block. |
| `/blacklist list` | Shows the users with a global block. |

The `user-id` option is text. Type the user ID (17 to 20 digits) or a user mention. The user does not need to be a member of the hub server.

## 4. Ticket commands and buttons

The `/ticket` command works only in a ticket channel. The bot finds the ticket from the channel.

| Command | Client ticket channel | Hub ticket channel | Ticket status |
|---|---|---|---|
| `/ticket add <user>` | Opener, client staff, participants (only if `participants-can-add` is on) | Not available | Open |
| `/ticket remove <user>` | Opener, client staff, participants (only if `participants-can-add` is on) | Not available | Open |
| `/ticket close [reason]` | Opener, client staff | Hub staff | Open |
| `/ticket close now:True` | No | Hub staff | Open |
| `/ticket reopen` | Opener (only below `max-open-tickets`), client staff | Hub staff | Closed, during the grace period |
| `/ticket info` | All members who can see the channel | All members who can see the channel | All |
| `/ticket claim` | Not available | Hub staff | Open |
| `/ticket unclaim` | Not available | Hub staff | Open |
| `/ticket transfer <staff>` | Not available | Hub staff | Open |
| `/ticket note <text>` | Not available | Hub staff | All |
| `/ticket rename <name>` | Client staff | Hub staff | Open |

Details:

- `/ticket close`: the reason can have a maximum of 500 characters.
- `/ticket close now:True`: closes the ticket at once, with no grace period. Nobody can reopen the ticket. The bot sends the transcripts and then removes the channels. Only hub staff can use this option, in the hub ticket channel.
- On the hub side, the close confirmation also shows the button **Close now (no reopen)**. It does the same as `now:True`.
- `/ticket reopen`: the bot refuses a reopen by the opener if the opener already has the maximum number of open tickets. Staff can always reopen.
- `/ticket transfer`: the new staff member must also be hub staff for this ticket.
- `/ticket note`: posts an "Internal note" embed in the hub ticket channel. The note can have a maximum of 4,000 characters. The bot does not relay it.
- `/ticket rename`: renames the two channels, for example to `ticket-0042-refund` and `acme-0042-refund`. The name can have a maximum of 40 characters. Discord allows only two renames of a channel in 10 minutes. If you rename more often, the bot waits.
- `/ticket add`: the bot does not add bots, yourself, the opener, staff, current participants, or blocked users.

The starter message of each ticket channel has buttons:

| Button | Client ticket channel | Hub ticket channel |
|---|---|---|
| **👥 Add people** | Opens a panel to add and remove participants. | Not available. |
| **🙋 Claim** | Not available. | Claims the ticket. |
| **🔒 Close** | Asks for confirmation, with an optional reason. | Asks for confirmation, with an optional reason. |
| **🔓 Reopen** | Shows only during the grace period. | Shows only during the grace period. |
| **📄 Info** | Not available. | Shows the ticket details. |

The same permission rules apply to the buttons and to the commands.

## 5. Common tasks

### 5.1 Connect a new client server

A client server admin does steps 1 to 4. A hub admin does steps 5 to 9.

1. Invite the bot to the client server with the invite link from the [setup guide](setup-guide.md#4-make-the-invite-link).
2. In the client server, run `/setup`.
3. Read the reply of the bot.
4. If the reply shows missing permissions, give the bot these permissions.
5. In the hub log channel, find the link request "New server wants to connect".
6. Click **Approve**.
7. In the **Tag** field, accept the suggested tag or type a different tag.
8. In **Hub category**, select the category for the tickets of this server.
9. Submit the form.

The status changes to `active`. The intake channel shows the live instructions.

You can also do steps 5 to 9 with `/clients approve <server> <tag> <category>`.

If the reply of `/setup` shows "I couldn’t reach the support team", the hub log channel is not set. Run `/hub setup` in the hub server. Then run `/setup` in the client server again.

### 5.2 Change the hub category of a client server

1. In the hub server, create the new category.
2. In the permissions of the category, allow your staff role to see the category.
3. In the permissions of the category, give the bot the permissions from the [setup guide](setup-guide.md#131-configure-the-hub-server).
4. Run `/clients set-category <server> <category>`.
5. Read the reply.
6. If the reply shows missing permissions, give the bot these permissions.

New tickets of the client server go to the new category. Open tickets stay in the old category.

### 5.3 Pause a client server

1. In the hub server, run `/clients pause <server> [message]`.
2. Optional: in `message`, type the text that users must see, for example "Support is closed until Monday."

The bot deletes new messages in the intake channel and shows the pause message. Open tickets continue to operate.

To start new tickets again, run `/clients resume <server>`.

### 5.4 Block a user

To block a user in one client server, do these steps:

1. In the client server, run `/blacklist add <user> [reason]`.
2. Run `/blacklist list` to make sure that the user is on the list.

To block a user in all client servers, do these steps:

1. In Discord, make sure that **Developer Mode** is on (**User Settings** > **Advanced**).
2. Right-click the user.
3. Click **Copy User ID**.
4. In the hub server, run `/blacklist add <user-id> [reason]`.
5. Run `/blacklist list` to make sure that the user is on the list.

The block does not close the open tickets of the user. To close them, use `/ticket close` in each ticket.

### 5.5 Turn on auto-close

1. In the hub server, run `/hub config auto-close <warn-hours> <close-hours>`. For example, use `48` and `24`.
2. Run `/hub config view` to make sure that the setting is correct.

With the example values, the bot asks the opener 48 hours after the last staff reply. The bot closes the ticket 24 hours after that question if the opener does not reply.

To turn off auto-close, run `/hub config auto-close-off`.

### 5.6 Change the staff identity mode

1. In the hub server, run `/hub config staff-identity <mode>`.
2. Select `named`, `anonymous`, or `role`.

The new mode applies to new relayed messages and new notices. Messages that the bot already relayed do not change.

## 6. Solve problems

### 6.1 Run a health check

In the client server, run `/config check`. The bot shows these items:

| Line | Problem | Action |
|---|---|---|
| Status | The connection status of the server. | If it is not `🟢 Connected`, refer to section 5.1. |
| My role | The bot role does not have all permissions from the invite link. | Give the bot role the missing permissions in **Server Settings** > **Roles**. |
| Category | The ticket category is missing, or it has 45 or more of 50 channels. | Run `/config category`. The bot also creates an overflow category automatically when a category is full. |
| Category permissions | The bot has missing permissions in the category. | Edit the category permissions. |
| Intake channel | The intake channel is missing, the bot has missing permissions, or the instruction message is missing. | Run `/config intake-channel` or `/setup`. |
| Log channel | The log channel is missing, or the bot cannot post in it. | Run `/config log-channel`. |
| Staff roles | No staff roles are set, or some roles were deleted. | Run `/config staff-roles add`. |

In the result, ✅ shows a correct item, ⚠️ shows a warning, and ❌ shows an error.

### 6.2 Missing permissions

The bot shows missing permissions in the replies of `/setup`, `/config`, `/hub setup`, `/clients approve`, and `/clients set-category`. The line starts with "⚠️ In #channel I’m missing:" or "⚠️ My role is missing:".

To correct missing permissions, do these steps:

1. Find the channel or category in the message.
2. Open the permissions of the channel or category.
3. Add the bot role, if it is not in the list.
4. Allow the missing permissions.
5. Run the command again, or run `/config check`.

If the bot cannot create a channel, the reply tells you to make sure that the bot has Manage Channels and Manage Roles.

### 6.3 Full categories and the channel limit

A Discord category can have a maximum of 50 channels. When the ticket category or the hub category is full, the bot creates an overflow category automatically. The overflow category has the same name with a number, for example `Tickets 2`, and the same permissions.

A Discord server can have a maximum of 500 channels. The hub server has the hub ticket channels of all client servers. When the hub server has 450 or more channels, the bot posts an alert in the hub log channel. The bot posts this alert a maximum of one time each hour.

To make room in the hub server, do one or more of these steps:

- Close old tickets.
- Delete old channels in the closed category, if you use `move` mode.
- Set the archive mode to `delete` with `/hub config archive-mode`.

### 6.4 Alerts in the hub log channel

| Alert | Cause | Action |
|---|---|---|
| New server wants to connect | A client server ran `/setup`. | Approve or reject the server (section 5.1). |
| Could not open a ticket | The bot could not create a ticket. The bot removed all parts of the ticket. The alert shows the server, the user, and the error. | Read the error. Run `/config check` in the client server. Make sure that the hub category exists and that the bot has its permissions. |
| The hub server has N of 500 channels | The hub server is almost full. | Refer to section 6.3. |
| The intake channel (or ticket category) of a server was deleted | A person deleted the channel in the client server. New tickets cannot open there. | Tell the admins of the client server to run `/setup`. |
| The category was deleted. I paused: … | A person deleted a hub category. The bot paused the active client servers that used it. | Run `/clients set-category` for each paused server. Then run `/clients resume`. |
| I was removed from a server | The bot left the client server or was removed. The bot set the server to `unlinked` and closed its tickets. | No action is necessary. To connect the server again, invite the bot and run `/setup`. |
| … unlinked a server | A hub admin ran `/clients unlink`. | No action is necessary. |
| Could not close all tickets of a server | The bot could not close one or more tickets. | Look at the hub ticket channels of that server. Close or delete them manually. |
| Could not move a channel to the closed category, so it was deleted | The closed category can be full or missing. | Make sure that the closed category exists and has room. |
| Could not delete the closed ticket channel | The bot could not delete a hub ticket channel. | Delete the channel manually. Make sure that the bot has Manage Channels in the category. |

At startup, the bot looks for linked client servers that it is no longer in. It sets each of these servers to `unlinked` and closes their tickets. The bot does this only if it is in the hub server.

### 6.5 Other problems

| Problem | Cause and action |
|---|---|
| The admin commands do not show. | You do not have Manage Server, or the commands are not registered. Restart the bot. Look for `Failed to register commands` in the log. |
| "This only works in the support team server." | You used a hub command in a client server. Use it in the hub server. |
| "This server isn’t set up yet. Run `/setup` first." | Run `/setup` in the client server. |
| "Use this inside a ticket channel." | Use `/ticket` in a ticket channel. |
| A deleted ticket channel | If a person deletes a ticket channel, the bot closes the ticket immediately. The bot makes a transcript from the other channel and deletes it. |
