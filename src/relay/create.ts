import type { Message } from 'discord.js';
import { logger } from '../core/logger.js';
import { chunkText } from '../core/text.js';
import { getHubConfig, updateTicket } from '../db/queries.js';
import type { TicketSide } from '../db/schema.js';
import { activityChanges } from './activity.js';
import { downloadAttachments } from './attachments.js';
import { resolveRelayAuthor } from './author.js';
import { fetchTicketChannel } from './channels.js';
import { authorEmbeds } from './embeds.js';
import { isHubNote, isRelayableSource } from './filters.js';
import { renderRelayContent, splitAttachmentsFor } from './render.js';
import { findCopies, getRelayedTicket, insertMessageLink } from './repo.js';
import { channelIdOf, lastRelayedChanges, otherSide } from './sides.js';
import { sendWithWebhook } from './webhooks.js';

const NOTE_REACTION = '🔒';

export interface RelayOptions {
  offline: boolean;
}

/** Must run in the ticket's queue. */
export async function handleSourceMessage(
  message: Message<true>,
  ticketId: number,
  side: TicketSide,
  options: RelayOptions,
): Promise<void> {
  if (!isRelayableSource(message)) return;
  if (isHubNote(side, message.content, getHubConfig().notePrefix)) {
    await message.react(NOTE_REACTION).catch((error: unknown) => {
      logger.warn(`Failed to mark internal note ${message.id}`, error);
    });
    // Moves catch-up past the note so it is not marked again after a restart.
    updateTicket(ticketId, lastRelayedChanges(side, message.id));
    return;
  }
  await relayNewMessage(message, ticketId, side, options);
}

async function relayNewMessage(
  message: Message<true>,
  ticketId: number,
  side: TicketSide,
  options: RelayOptions,
): Promise<void> {
  const ticket = getRelayedTicket(ticketId);
  // Catch-up and the live event can both see the same message.
  if (!ticket || findCopies(message.id).length > 0) return;

  const targetSide = otherSide(side);
  const target = await fetchTicketChannel(message.client, channelIdOf(ticket, targetSide));
  if (!target) {
    logger.warn(`Ticket ${ticket.id} has no ${targetSide} channel; message ${message.id} dropped`);
    return;
  }

  const author = await resolveRelayAuthor(message, side, ticket);
  const { upload, link } = splitAttachmentsFor(message, target);
  const { files, failed } = await downloadAttachments(upload);
  const content = await renderRelayContent(message, target, {
    linkedAttachments: [...link, ...failed],
    offline: options.offline,
  });
  const embeds = authorEmbeds(
    message.embeds.map((embed) => embed.toJSON()),
    message.content,
  );

  if (content.length > 0 || files.length > 0 || embeds.length > 0) {
    const chunks = chunkText(content);
    for (const [copyIndex, chunk] of chunks.entries()) {
      const isLast = copyIndex === chunks.length - 1;
      const sent = await sendWithWebhook(message.client, ticket.id, targetSide, {
        content: chunk || undefined,
        username: author.identity.username,
        avatarURL: author.identity.avatarURL,
        allowedMentions: { parse: [] },
        ...(isLast ? { files, embeds } : {}),
      });
      insertMessageLink({
        ticketId: ticket.id,
        sourceSide: side,
        sourceMessageId: message.id,
        copyIndex,
        copyMessageId: sent.id,
        authorId: message.author.id,
      });
    }
  }

  updateTicket(ticket.id, {
    ...lastRelayedChanges(side, message.id),
    ...activityChanges(
      ticket,
      { side, authorId: message.author.id, isStaff: author.isStaff },
      new Date(),
    ),
  });
}
