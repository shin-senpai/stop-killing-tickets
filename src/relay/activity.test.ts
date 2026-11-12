import { describe, expect, it } from 'vitest';
import { activityChanges } from './activity.js';

const now = new Date('2026-01-01T00:00:00Z');
const ticket = { openerId: 'opener' };

describe('activityChanges', () => {
  it('records opener activity and clears the auto-close warning', () => {
    expect(
      activityChanges(ticket, { side: 'client', authorId: 'opener', isStaff: false }, now),
    ).toEqual({ lastOpenerActivityAt: now, autoCloseWarnedAt: null });
  });

  it('records staff activity for hub messages', () => {
    expect(activityChanges(ticket, { side: 'hub', authorId: 'bob', isStaff: false }, now)).toEqual({
      lastStaffActivityAt: now,
    });
  });

  it('records staff activity for client staff', () => {
    expect(
      activityChanges(ticket, { side: 'client', authorId: 'mod', isStaff: true }, now),
    ).toEqual({ lastStaffActivityAt: now });
  });

  it('records nothing for participants', () => {
    expect(
      activityChanges(ticket, { side: 'client', authorId: 'friend', isStaff: false }, now),
    ).toEqual({});
  });
});
