# User Guide

This guide is for members of a Discord server that uses this bot for support. It tells you how to open a ticket, talk with the support team, and close the ticket.

## Terms

| Term | Description |
|---|---|
| **Ticket** | A private conversation between you and the support team. |
| **Intake channel** | The channel where you open a ticket. The usual name is `#open-a-ticket`. |
| **Ticket channel** | The private channel of your ticket. |
| **Support team** | The people who answer tickets. |
| **Server staff** | The moderators of this server. They can also see and answer your ticket. |
| **Opener** | The person who opened the ticket. |
| **Participant** | A person that the opener added to the ticket. |

## 1. Open a ticket

1. Go to the intake channel.
2. Read the pinned instruction message.
3. Type a message that tells the support team about your problem.
4. Optional: attach files, for example screenshots.
5. Send the message.

Write a clear subject. Your first message becomes the subject of the ticket. The support team sees it first.

The bot deletes your message from the intake channel immediately. This is normal. The bot keeps your text and your files in the ticket.

## 2. What happens next

1. A short notice shows in the intake channel: "@You, your ticket is open: #ticket-0042-yourname". The notice goes away after approximately 10 seconds.
2. A new ticket channel shows in the ticket category. The name has the ticket number and your username, for example `ticket-0042-yourname`.
3. Click the link in the notice, or find the ticket channel in the channel list.

Only these people can see your ticket channel:

- You.
- The participants that you add.
- The server staff.
- The bot.

Other members of the server cannot see your ticket.

The bot pins a starter message at the top of the ticket channel. The starter message shows:

- The ticket number.
- Your subject.
- Who opened the ticket and when.
- The status of the ticket.
- The participants, if there are participants.
- The **👥 Add people** and **🔒 Close** buttons.

If you attached files to your first message, the bot posts them in a second message: "Files from the opening message:". If a file is too large, the bot posts a link to it.

The status shows "🟢 Open · Waiting for support". When a member of the support team takes your ticket, the status changes, for example to "🟢 Open · Bob is helping you". The bot also posts a notice in the ticket.

## 3. Talk with the support team

Send your messages in the ticket channel. The support team receives all of your messages.

The replies of the support team show in the ticket channel. The name shows in one of these forms:

| Form | Example |
|---|---|
| A name and the word "Support" | `Bob · Support` |
| "Support Team" and a role name | `Support Team · Moderator` |
| Only "Support Team" | `Support Team` |

These replies show the Discord **APP** label. This is normal. The support team can work from a different Discord server, and the bot sends their replies to your ticket channel. You do not need to join a different server.

The server staff can also reply in your ticket channel.

The bot sends these items to the support team:

| Item | What the support team receives |
|---|---|
| Messages | Your text. Long messages are split into more than one message. |
| Files | Your files. If a file is too large, the support team receives a link. |
| Edits | The edited text. |
| Deleted messages | The bot deletes the copy also. |
| Replies | A quote line that shows the message that you replied to. |
| Stickers | The sticker image or the sticker name. |

The bot does not send reactions, pins, or threads to the support team. Put all important information in messages.

Mentions do not notify people in a different server. If you mention a person, the support team sees the name as plain text.

## 4. Add and remove people

You can add other members of the server to your ticket. For example, add a friend who has the same problem.

To add people, do these steps:

1. In the ticket channel, click **👥 Add people**.
2. In the **Add people** menu, select one or more members. You can select a maximum of 10 members at one time.
3. The bot gives these members access to the ticket channel.
4. The bot posts a notice in the ticket: "@You added @Friend to the ticket."

To remove people, do these steps:

1. In the ticket channel, click **👥 Add people**.
2. In the **Remove people** menu, select the participants to remove.
3. The bot removes the access of these participants.

The panel also tells you how many more people can join the ticket.

You can also use these commands in the ticket channel:

| Command | Action |
|---|---|
| `/ticket add <user>` | Adds a member to the ticket. |
| `/ticket remove <user>` | Removes a participant from the ticket. |
| `/ticket info` | Shows the details of the ticket. |

Rules:

- The opener and the server staff can add or remove people. Participants can do this only if the server allows it.
- A ticket can have a maximum of 5 participants. The server can change this limit.
- You cannot add bots, yourself, or a person who is already in the ticket.
- You cannot add a person who is blocked from tickets.
- You do not need to add the server staff. They can already see the ticket.
- Nobody can remove the opener from the ticket.
- If a participant leaves the server, the bot removes the participant from the ticket.

## 5. Close a ticket

When your problem is solved, close the ticket.

1. In the ticket channel, click **🔒 Close**.
2. Click **Close** to confirm.

To give a reason, do these steps instead:

1. In the ticket channel, click **🔒 Close**.
2. Click **Close with reason**.
3. Type the reason.
4. Submit the form.

You can also use the command `/ticket close [reason]`.

The opener, the server staff, and the support team can close a ticket. Participants cannot close a ticket.

After the close, these things occur:

- The bot posts a notice in the ticket, for example "🔒 Ticket closed by @You."
- The notice also shows the reason and the time when the bot deletes the channel.
- You and the participants cannot send messages in the ticket channel.
- The status shows "🟠 Closed · Can be reopened until" and a time.
- A **🔓 Reopen** button shows in the starter message for a short period (usually 10 minutes).
- At the end of this period, the bot deletes the ticket channel.

## 6. Reopen a ticket

If you closed the ticket too early, you can reopen it during the short period after the close.

1. In the ticket channel, click **🔓 Reopen**.

You can also use the command `/ticket reopen`.

The opener and the staff can reopen a ticket. The bot posts the notice "🔓 Ticket reopened by" and the name.

If you already have the maximum number of open tickets, you cannot reopen the old ticket. The bot shows "You already have an open ticket. Close it before you reopen this one." Close the other ticket first, or ask the staff to reopen the old ticket.

After the bot deletes the ticket channel, you cannot reopen the ticket. Open a new ticket instead. The support team can see the number of your old tickets.

## 7. Receive a transcript

When a ticket closes, the bot sends you a transcript in a direct message (DM). The message says "Your ticket in **Server** was closed." The transcript is an HTML file with the messages of the ticket. Open the file in a web browser.

If you reopen the ticket and close it again, you receive a new transcript.

To receive the transcript, do these steps before you close the ticket:

1. Right-click the server icon.
2. Click **Privacy Settings**.
3. Turn on **Direct Messages**.

If your DMs are closed, the bot cannot send the transcript. The bot does not try again.

The server can turn off transcripts in DMs. In this case, you do not receive a transcript.

The transcript does not contain the internal notes of the support team.

## 8. Automatic close

The support team can turn on the automatic close. If it is on, these things occur:

1. The support team sends a reply.
2. You do not send a message for some hours.
3. The bot asks you in the ticket channel: "Is this resolved? This ticket will close" and a time "if there's no reply."
4. If you do not send a message before that time, the bot closes the ticket with the reason "Inactivity".

To keep the ticket open, send a message in the ticket channel. Each message from you stops the countdown.

## 9. Limits

| Limit | Usual value | What occurs |
|---|---|---|
| Open tickets | 1 for each user | The bot does not open a new ticket. The notice gives a link to your open ticket. |
| Minimum subject length | 10 characters | The bot deletes your message and does not open a ticket. |
| Maximum subject length | 4,000 characters | The bot keeps only the first 4,000 characters. |
| Participants | 5 for each ticket | You cannot add more people. |
| Wait after a close | 0 (no wait) | The bot does not open a new ticket. The notice tells you when you can open a new ticket. The wait starts when your last ticket closes. |

The server admins can change these values, except the maximum subject length.

If the server staff blocked you from tickets, the bot does not open a ticket.

## 10. If nothing happens

Use this table if the bot does not open a ticket or does not answer.

| Problem | Cause | Action |
|---|---|---|
| The notice says "you can't open tickets here". | The staff blocked you from tickets. | Speak to the server staff. |
| The notice says "you already have an open ticket". | You have the maximum number of open tickets. | Use the link in the notice. Send your new question in that ticket. |
| The notice says "please describe your problem in at least" a number of characters. | Your message is too short. | Write a longer message. |
| The notice says "you can open a new ticket" and a time. | You must wait after a close. | Try again after that time. |
| The notice says "your ticket is already being set up". | You sent two messages quickly. | Wait for the first ticket. |
| The notice says "Tickets are not open yet". | The server is not connected to the support team. | Tell the server staff. Try again later. |
| The notice shows a message about a pause. | The support team stopped new tickets for a period. | Try again later. Your open tickets continue to operate. |
| The notice says "Support is unavailable right now". | The server is not connected to the support team. | Tell the server staff. |
| The notice says "we couldn't open a ticket right now". | An error occurred. The staff got a notification. | Wait a few minutes. Try again. |
| Your message stays in the intake channel and no ticket opens. | You are server staff, or the bot is offline. | Server staff cannot open tickets in the intake channel. Tell a different staff member, or try again later. |
| You cannot find your ticket channel. | The channel list is collapsed, or the ticket closed. | Open the ticket category in the channel list. Use the link in the notice. |
| You cannot send messages in the ticket channel. | The ticket is closed. | Click **🔓 Reopen**, or open a new ticket. |
| Nobody answers. | The support team is busy. | Wait. Do not open more tickets. Send more information in the same ticket. |

If the bot is offline, it does not lose your messages in the ticket channel. When the bot starts again, it sends them to the support team.
