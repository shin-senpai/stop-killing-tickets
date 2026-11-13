import type { Client, User } from 'discord.js';
import { getHubConfig } from '../db/queries.js';
import type { Ticket } from '../db/schema.js';
import { runStep } from './channels.js';
import { finalizeTicket } from './finalize.js';
import { postCloseNotices, postReopenNotices, resolveActor } from './notices.js';
import { setTicketMembersCanSend } from './permissions.js';
import { markTicketClosing, markTicketReopened, type TicketPatch } from './repo.js';
import { refreshStarterMessages } from './starter.js';
import { withTicketLock } from './ticketLock.js';
import { deliverTranscripts } from './transcript.js';

const MINUTE = 60_000;

export interface CloseOptions {
  /** Skip the grace period: no reopen, channels are removed at once. */
  immediate?: boolean;
}

/**
 * Starts the grace period, or with `immediate` closes for good. Does nothing if
 * the ticket is no longer open. A null `closedBy` means the bot closed it, for
 * example for inactivity.
 */
export function closeTicket(
  client: Client<true>,
  ticket: Ticket,
  closedBy: User | null,
  reason: string | null,
  { immediate = false }: CloseOptions = {},
): Promise<void> {
  return withTicketLock(ticket.id, async () => {
    const hub = getHubConfig();
    const now = Date.now();
    const graceMs = immediate ? 0 : hub.graceMinutes * MINUTE;
    const closing = markTicketClosing(ticket.id, {
      closingUntil: new Date(now + graceMs),
      // Set now, not at finalize, so the intake cooldown starts at the close.
      closedAt: new Date(now),
      closedBy: closedBy?.id ?? null,
      closeReason: reason,
    });
    if (!closing) return;

    await runStep(`lock ticket ${ticket.id}`, () =>
      setTicketMembersCanSend(client, closing, false),
    );
    await postCloseNotices(
      client,
      closing,
      closedBy ? await resolveActor(client, closing, closedBy.id) : null,
      hub,
      { reopenable: !immediate },
    );
    if (immediate) {
      await deliverTranscripts(client, closing);
      await finalizeTicket(client, closing);
      return;
    }
    await runStep(`refresh starters of ticket ${ticket.id}`, () =>
      refreshStarterMessages(client, closing),
    );
    await deliverTranscripts(client, closing);
  });
}

/** Does nothing if the ticket is not in its grace period. */
export function reopenTicket(
  client: Client<true>,
  ticket: Ticket,
  reopenedBy: User,
): Promise<void> {
  return withTicketLock(ticket.id, async () => {
    const reopened = markTicketReopened(ticket.id, activityReset(ticket, reopenedBy));
    if (!reopened) return;

    await runStep(`unlock ticket ${ticket.id}`, () =>
      setTicketMembersCanSend(client, reopened, true),
    );
    await postReopenNotices(client, reopened, await resolveActor(client, reopened, reopenedBy.id));
    await runStep(`refresh starters of ticket ${ticket.id}`, () =>
      refreshStarterMessages(client, reopened),
    );
  });
}

/** Without this, a ticket closed for inactivity would get a new warning on the next tick. */
function activityReset(ticket: Ticket, reopenedBy: User): TicketPatch {
  const now = new Date();
  return reopenedBy.id === ticket.openerId
    ? { lastOpenerActivityAt: now }
    : { lastStaffActivityAt: now };
}
