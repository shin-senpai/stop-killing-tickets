import { KeyedSerialQueue } from '../core/serialQueue.js';

const queue = new KeyedSerialQueue<number>();

/**
 * Serializes state changes of one ticket (close, reopen, finalize, claim,
 * participants). A task that waited must re-read the ticket, because the one
 * before it may have changed its status.
 */
export function withTicketLock<T>(ticketId: number, task: () => Promise<T>): Promise<T> {
  return queue.run(ticketId, task);
}
