import { describe, expect, it } from 'vitest';
import {
  cooldownEndsAt,
  participantRejection,
  remainingParticipantSlots,
  type ParticipantCandidate,
} from './rules.js';

describe('cooldownEndsAt', () => {
  const closedAt = new Date(1_000_000);

  it('is null without a cooldown', () => expect(cooldownEndsAt(closedAt, 0, 1_000_001)).toBeNull());
  it('is null without a closed ticket', () => expect(cooldownEndsAt(null, 60)).toBeNull());

  it('returns the end while the cooldown runs', () => {
    expect(cooldownEndsAt(closedAt, 60, 1_030_000)).toEqual(new Date(1_060_000));
  });

  it('is null after the cooldown', () =>
    expect(cooldownEndsAt(closedAt, 60, 1_060_000)).toBeNull());
});

describe('remainingParticipantSlots', () => {
  it('counts free slots', () => expect(remainingParticipantSlots(5, 2)).toBe(3));
  it('never goes below zero', () => expect(remainingParticipantSlots(2, 5)).toBe(0));
});

describe('participantRejection', () => {
  const allowed: ParticipantCandidate = {
    isMember: true,
    isBot: false,
    isActor: false,
    isOpener: false,
    isParticipant: false,
    isStaff: false,
    isBlacklisted: false,
  };

  it('accepts a normal member', () => expect(participantRejection(allowed)).toBeNull());

  it.each([
    ['isMember', false, 'is not in this server'],
    ['isBot', true, 'is a bot'],
    ['isActor', true, 'is you'],
    ['isOpener', true, 'opened this ticket'],
    ['isParticipant', true, 'is already in this ticket'],
    ['isStaff', true, 'is staff and already has access'],
    ['isBlacklisted', true, 'cannot be added'],
  ] as const)('rejects when %s is %s', (key, value, reason) => {
    expect(participantRejection({ ...allowed, [key]: value })).toBe(reason);
  });
});
