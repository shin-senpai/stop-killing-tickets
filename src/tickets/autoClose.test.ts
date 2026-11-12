import { describe, expect, it } from 'vitest';
import { autoCloseSettings, decideAutoClose } from './autoClose.js';

const HOUR = 3_600_000;
const settings = { warnHours: 24, closeHours: 12 };
const now = new Date('2026-01-10T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR);

function ticket(overrides: Partial<Parameters<typeof decideAutoClose>[0]> = {}) {
  return {
    status: 'open' as const,
    createdAt: hoursAgo(100),
    lastOpenerActivityAt: hoursAgo(50),
    lastStaffActivityAt: hoursAgo(30),
    autoCloseWarnedAt: null,
    ...overrides,
  };
}

describe('autoCloseSettings', () => {
  it('is off when either value is missing', () => {
    expect(
      autoCloseSettings({ autoCloseWarnHours: 24, autoCloseCloseHours: null }),
    ).toBeUndefined();
    expect(
      autoCloseSettings({ autoCloseWarnHours: null, autoCloseCloseHours: 12 }),
    ).toBeUndefined();
  });

  it('is off for zero hours', () => {
    expect(autoCloseSettings({ autoCloseWarnHours: 0, autoCloseCloseHours: 12 })).toBeUndefined();
  });

  it('returns both values when set', () => {
    expect(autoCloseSettings({ autoCloseWarnHours: 24, autoCloseCloseHours: 12 })).toEqual(
      settings,
    );
  });
});

describe('decideAutoClose', () => {
  it('warns when staff spoke last and the warn time has passed', () => {
    expect(decideAutoClose(ticket(), settings, now)).toBe('warn');
  });

  it('waits before the warn time', () => {
    expect(decideAutoClose(ticket({ lastStaffActivityAt: hoursAgo(10) }), settings, now)).toBe(
      'none',
    );
  });

  it('does nothing when the opener spoke last', () => {
    const t = ticket({ lastOpenerActivityAt: hoursAgo(20), lastStaffActivityAt: hoursAgo(30) });
    expect(decideAutoClose(t, settings, now)).toBe('none');
  });

  it('does nothing when staff never spoke', () => {
    expect(decideAutoClose(ticket({ lastStaffActivityAt: null }), settings, now)).toBe('none');
  });

  it('uses the creation time when the opener never wrote in the channel', () => {
    const t = ticket({ lastOpenerActivityAt: null, lastStaffActivityAt: hoursAgo(30) });
    expect(decideAutoClose(t, settings, now)).toBe('warn');
  });

  it('does nothing for tickets that are not open', () => {
    expect(decideAutoClose(ticket({ status: 'closing' }), settings, now)).toBe('none');
  });

  it('waits after the warning until the close time', () => {
    expect(decideAutoClose(ticket({ autoCloseWarnedAt: hoursAgo(6) }), settings, now)).toBe('none');
  });

  it('closes when the close time after the warning has passed', () => {
    expect(decideAutoClose(ticket({ autoCloseWarnedAt: hoursAgo(12) }), settings, now)).toBe(
      'close',
    );
  });

  it('does not close when the opener wrote after the warning', () => {
    const t = ticket({
      autoCloseWarnedAt: hoursAgo(20),
      lastOpenerActivityAt: hoursAgo(15),
      lastStaffActivityAt: hoursAgo(14),
    });
    expect(decideAutoClose(t, settings, now)).toBe('none');
  });
});
