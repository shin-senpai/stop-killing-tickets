import type { Client } from 'discord.js';
import { logger } from '../core/logger.js';
import { getHubConfig, getTicket } from '../db/queries.js';
import type { Ticket } from '../db/schema.js';
import {
  autoCloseSettings,
  decideAutoClose,
  type AutoCloseAction,
  type AutoCloseSettings,
} from './autoClose.js';
import { sendToTicketChannel } from './channels.js';
import { closeTicket } from './close.js';
import { finalizeTicket } from './finalize.js';
import { postNotice } from './notices.js';
import { relativeTime } from './noticeText.js';
import { getAutoCloseCandidates, getTicketsDueForFinalize, setAutoCloseWarnedAt } from './repo.js';
import { withTicketLock } from './ticketLock.js';

const TICK_INTERVAL_MS = 60_000;
const HOUR = 3_600_000;

let started = false;

/** All schedule state lives in the database, so a restart loses nothing. */
export function startLifecycleScheduler(client: Client<true>): void {
  if (started) return;
  started = true;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runTick(client);
    } catch (error) {
      logger.error('Lifecycle scheduler tick failed', error);
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), TICK_INTERVAL_MS).unref();
}

async function runTick(client: Client<true>): Promise<void> {
  await finalizeDueTickets(client);
  const settings = autoCloseSettings(getHubConfig());
  if (settings) await applyAutoClose(client, settings);
}

async function finalizeDueTickets(client: Client<true>): Promise<void> {
  for (const { id } of getTicketsDueForFinalize(new Date())) {
    await runForTicket(id, 'finalize', () =>
      withTicketLock(id, async () => {
        const ticket = getTicket(id);
        if (ticket?.status !== 'closing' || !ticket.closingUntil) return;
        if (ticket.closingUntil.getTime() > Date.now()) return;
        await finalizeTicket(client, ticket);
      }),
    );
  }
}

async function applyAutoClose(client: Client<true>, settings: AutoCloseSettings): Promise<void> {
  for (const candidate of getAutoCloseCandidates()) {
    const action = decideAutoClose(candidate, settings, new Date());
    if (action === 'warn') {
      await runForTicket(candidate.id, 'auto-close warning', () =>
        withTicketLock(candidate.id, async () => {
          const ticket = ticketStillDue(candidate.id, settings, 'warn');
          if (ticket) await warnOpener(client, ticket, settings.closeHours);
        }),
      );
    } else if (action === 'close') {
      await runForTicket(candidate.id, 'auto-close', async () => {
        const ticket = ticketStillDue(candidate.id, settings, 'close');
        if (ticket) await closeTicket(client, ticket, null, 'Inactivity');
      });
    }
  }
}

/** A relayed opener message may have reset the timer since the candidates were read. */
function ticketStillDue(
  ticketId: number,
  settings: AutoCloseSettings,
  action: AutoCloseAction,
): Ticket | undefined {
  const ticket = getTicket(ticketId);
  return ticket && decideAutoClose(ticket, settings, new Date()) === action ? ticket : undefined;
}

/** The warning time is saved first so a failing channel does not get a new warning every minute. */
async function warnOpener(client: Client<true>, ticket: Ticket, closeHours: number): Promise<void> {
  const warnedAt = new Date();
  setAutoCloseWarnedAt(ticket.id, warnedAt);
  const closesAt = relativeTime(new Date(warnedAt.getTime() + closeHours * HOUR));

  await sendToTicketChannel(client, ticket, 'client', {
    content: `<@${ticket.openerId}> Is this resolved? This ticket will close ${closesAt} if there's no reply.`,
    allowedMentions: { users: [ticket.openerId] },
  });
  await postNotice(
    client,
    ticket,
    'hub',
    `⏰ Sent an inactivity reminder. The ticket will close ${closesAt} if the user doesn't reply.`,
  );
}

async function runForTicket(
  ticketId: number,
  task: string,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error(`Scheduler ${task} failed for ticket ${ticketId}`, error);
  }
}
