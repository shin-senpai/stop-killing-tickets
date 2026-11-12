import { describe, expect, it } from 'vitest';
import {
  actorLabel,
  closeNoticeText,
  formatDuration,
  reopenNoticeText,
  ticketLabel,
} from './noticeText.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatDuration', () => {
  it('handles very short durations', () =>
    expect(formatDuration(10_000)).toBe('less than a minute'));
  it('shows minutes', () => expect(formatDuration(5 * MINUTE)).toBe('5m'));
  it('shows hours and minutes', () =>
    expect(formatDuration(2 * HOUR + 15 * MINUTE)).toBe('2h 15m'));
  it('drops zero minutes', () => expect(formatDuration(3 * HOUR)).toBe('3h'));
  it('shows days and hours', () =>
    expect(formatDuration(2 * DAY + 3 * HOUR + 7 * MINUTE)).toBe('2d 3h'));
  it('drops zero hours', () => expect(formatDuration(4 * DAY)).toBe('4d'));
});

describe('ticketLabel', () => {
  it('uses the tag and padded number', () => expect(ticketLabel('acme', 42)).toBe('acme-0042'));
  it('falls back without a tag', () => expect(ticketLabel(null, 7)).toBe('ticket-0007'));
});

describe('actorLabel', () => {
  const staff = { id: '1', clientLabel: 'Support Team' };

  it('mentions the actor on the hub side', () => {
    expect(actorLabel(staff, 'hub')).toBe('<@1>');
  });

  it('uses the client label on the client side', () => {
    expect(actorLabel(staff, 'client')).toBe('Support Team');
  });
});

describe('closeNoticeText', () => {
  const base = {
    closer: { id: '1', clientLabel: 'Bob' },
    reason: 'Solved',
    closingUntil: new Date(1_700_000_000_000),
    audience: 'hub' as const,
    channelFate: 'deleted' as const,
  };

  it('names the closer, the reason and when the channel goes away', () => {
    expect(closeNoticeText(base)).toBe(
      '🔒 Ticket closed by <@1>.\nReason: Solved\nThis channel will be deleted <t:1700000000:R>.',
    );
  });

  it('leaves out an empty reason', () => {
    expect(closeNoticeText({ ...base, reason: null, channelFate: 'archived' })).toBe(
      '🔒 Ticket closed by <@1>.\nThis channel will be archived <t:1700000000:R>.',
    );
  });

  it('describes a close by the system', () => {
    expect(closeNoticeText({ ...base, closer: null, reason: 'Inactivity' })).toMatch(
      /^🔒 Ticket closed automatically\.\nReason: Inactivity/,
    );
  });
});

describe('reopenNoticeText', () => {
  it('uses the client label on the client side', () => {
    expect(reopenNoticeText({ id: '1', clientLabel: 'Support Team' }, 'client')).toBe(
      '🔓 Ticket reopened by Support Team.',
    );
  });
});
