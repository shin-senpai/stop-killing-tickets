/** Returns when the user may open a new ticket, or null if they may open one now. */
export function cooldownEndsAt(
  lastClosedAt: Date | null,
  cooldownSeconds: number,
  now = Date.now(),
): Date | null {
  if (!lastClosedAt || cooldownSeconds <= 0) return null;
  const end = lastClosedAt.getTime() + cooldownSeconds * 1000;
  return end > now ? new Date(end) : null;
}

export function remainingParticipantSlots(maxParticipants: number, currentCount: number): number {
  return Math.max(0, maxParticipants - currentCount);
}

export interface ParticipantCandidate {
  isMember: boolean;
  isBot: boolean;
  isActor: boolean;
  isOpener: boolean;
  isParticipant: boolean;
  isStaff: boolean;
  isBlacklisted: boolean;
}

/** Why a user cannot be added to a ticket, or null if they can. */
export function participantRejection(candidate: ParticipantCandidate): string | null {
  if (!candidate.isMember) return 'is not in this server';
  if (candidate.isBot) return 'is a bot';
  if (candidate.isActor) return 'is you';
  if (candidate.isOpener) return 'opened this ticket';
  if (candidate.isParticipant) return 'is already in this ticket';
  if (candidate.isStaff) return 'is staff and already has access';
  if (candidate.isBlacklisted) return 'cannot be added';
  return null;
}
