import type { Client } from 'discord.js';
import { getTicket } from '../db/queries.js';
import { deleteCopyLinks, deleteLinkByCopy, findCopies } from './repo.js';
import { otherSide } from './sides.js';
import { deleteCopy } from './webhooks.js';

/**
 * Handles a deleted message in a ticket channel. A deleted source message
 * takes its copies with it. A deleted copy only loses its link, so a
 * moderator removing a copy never deletes the original.
 */
export async function relayDeletion(discord: Client<true>, messageId: string): Promise<void> {
  if (findCopies(messageId).length === 0) {
    deleteLinkByCopy(messageId);
    return;
  }
  await deleteAllCopies(discord, messageId);
}

export async function deleteAllCopies(
  discord: Client<true>,
  sourceMessageId: string,
): Promise<void> {
  for (const link of findCopies(sourceMessageId)) {
    const ticket = getTicket(link.ticketId);
    if (ticket) await deleteCopy(discord, ticket, otherSide(link.sourceSide), link.copyMessageId);
  }
  deleteCopyLinks(sourceMessageId);
}
