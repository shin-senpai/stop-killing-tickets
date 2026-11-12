import type { Message } from 'discord.js';
import { logger } from '../core/logger.js';
import { chunkText } from '../core/text.js';
import { getHubConfig } from '../db/queries.js';
import type { TicketSide } from '../db/schema.js';
import { resolveRelayAuthor } from './author.js';
import { fetchTicketChannel } from './channels.js';
import { planCopyEdits } from './copyPlan.js';
import { deleteAllCopies } from './delete.js';
import { isHubNote } from './filters.js';
import { renderRelayContent, splitAttachmentsFor } from './render.js';
import { deleteCopyLink, findCopies, getActiveTicket, insertMessageLink } from './repo.js';
import { channelIdOf, otherSide } from './sides.js';
import { deleteCopy, editCopy, sendWithWebhook } from './webhooks.js';

/**
 * Brings the copies of an edited message up to date. Only the text changes:
 * uploaded files stay on the copy they were first sent with.
 */
export async function relayEdit(
  message: Message<true>,
  ticketId: number,
  side: TicketSide,
): Promise<void> {
  const ticket = getActiveTicket(ticketId);
  const copies = findCopies(message.id);
  if (!ticket || copies.length === 0) return;

  if (isHubNote(side, message.content, getHubConfig().notePrefix)) {
    await deleteAllCopies(message.client, message.id);
    return;
  }

  const targetSide = otherSide(side);
  const target = await fetchTicketChannel(message.client, channelIdOf(ticket, targetSide));
  if (!target) return;

  const content = await renderRelayContent(message, target, {
    linkedAttachments: splitAttachmentsFor(message, target).link,
    offline: false,
  });
  const plan = planCopyEdits(copies, chunkText(content));

  for (const edit of plan.edits) {
    const edited = await editCopy(ticket, targetSide, edit.copyMessageId, edit.content);
    if (!edited) {
      logger.debug(`Copy ${edit.copyMessageId} of message ${message.id} can no longer be edited`);
      deleteCopyLink(message.id, edit.copyIndex);
    }
  }

  for (const deletion of plan.deletions) {
    await deleteCopy(message.client, ticket, targetSide, deletion.copyMessageId);
    deleteCopyLink(message.id, deletion.copyIndex);
  }

  if (plan.appends.length === 0) return;
  const { identity } = await resolveRelayAuthor(message, side, ticket);
  for (const append of plan.appends) {
    const sent = await sendWithWebhook(message.client, ticket.id, targetSide, {
      content: append.content,
      username: identity.username,
      avatarURL: identity.avatarURL,
      allowedMentions: { parse: [] },
    });
    insertMessageLink({
      ticketId: ticket.id,
      sourceSide: side,
      sourceMessageId: message.id,
      copyIndex: append.copyIndex,
      copyMessageId: sent.id,
      authorId: message.author.id,
    });
  }
}
