import type { Ticket } from '../db/schema.js';

const HOUR = 3_600_000;

export type AutoCloseAction = 'none' | 'warn' | 'close';

export interface AutoCloseSettings {
  warnHours: number;
  closeHours: number;
}

type AutoCloseTicket = Pick<
  Ticket,
  'status' | 'createdAt' | 'lastOpenerActivityAt' | 'lastStaffActivityAt' | 'autoCloseWarnedAt'
>;

export function autoCloseSettings(hub: {
  autoCloseWarnHours: number | null;
  autoCloseCloseHours: number | null;
}): AutoCloseSettings | undefined {
  const { autoCloseWarnHours: warnHours, autoCloseCloseHours: closeHours } = hub;
  if (!warnHours || !closeHours || warnHours <= 0 || closeHours <= 0) return undefined;
  return { warnHours, closeHours };
}

/**
 * Auto-close applies only while staff spoke last: the opener is warned after
 * `warnHours` of silence, and the ticket closes `closeHours` after the warning
 * if the opener still has not written.
 */
export function decideAutoClose(
  ticket: AutoCloseTicket,
  settings: AutoCloseSettings,
  now: Date,
): AutoCloseAction {
  if (ticket.status !== 'open' || !ticket.lastStaffActivityAt) return 'none';

  const lastOpenerActivity = ticket.lastOpenerActivityAt ?? ticket.createdAt;
  if (ticket.lastStaffActivityAt <= lastOpenerActivity) return 'none';

  const warnedAt = ticket.autoCloseWarnedAt;
  if (!warnedAt) {
    return elapsedHours(ticket.lastStaffActivityAt, now) >= settings.warnHours ? 'warn' : 'none';
  }
  if (lastOpenerActivity > warnedAt) return 'none';
  return elapsedHours(warnedAt, now) >= settings.closeHours ? 'close' : 'none';
}

function elapsedHours(since: Date, now: Date): number {
  return (now.getTime() - since.getTime()) / HOUR;
}
