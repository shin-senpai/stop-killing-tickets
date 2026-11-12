import { escapeMarkdown, userMention, type Client, type GuildMember, type User } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { isClientStaff } from '../core/staff.js';
import { getParticipantIds, getTicket, isBlacklisted } from '../db/queries.js';
import type { Ticket } from '../db/schema.js';
import { requireOpen, requireSide, type TicketScope } from './access.js';
import { fetchTicketChannel } from '../relay/channels.js';
import { grantTicketAccess, revokeTicketAccess } from './permissions.js';
import { addParticipantRows, removeParticipantRows } from './repo.js';
import { participantRejection, remainingParticipantSlots } from './rules.js';
import { refreshStarterMessages } from './starter.js';
import { withTicketLock } from './ticketLock.js';
import { postTicketNotice } from './notices.js';

export interface PersonRef {
  id: string;
  name: string;
}

export interface ParticipantChange {
  changed: PersonRef[];
  skipped: { person: PersonRef; reason: string }[];
}

export interface Candidate {
  user: User;
  /** Null when the user is not a member of the client server. */
  member: GuildMember | null;
}

export function personOf(user: User, member: GuildMember | null): PersonRef {
  return { id: user.id, name: member?.displayName ?? user.displayName };
}

export function requireCanManageParticipants(member: GuildMember, scope: TicketScope): void {
  requireSide(scope, 'client');
  requireOpen(scope.ticket);
  const { ticket, server } = scope;
  const isOpener = member.id === ticket.openerId;
  const isAllowedParticipant =
    server.participantsCanAdd && getParticipantIds(ticket.id).includes(member.id);
  if (!isOpener && !isAllowedParticipant && !isClientStaff(member, server)) {
    throw new UserFacingError(
      'Only the person who opened this ticket or staff can add or remove people.',
    );
  }
}

export function addParticipants(
  client: Client<true>,
  scope: TicketScope,
  actor: GuildMember,
  candidates: Candidate[],
): Promise<ParticipantChange> {
  return withTicketLock(scope.ticket.id, () =>
    addLocked(client, { ...scope, ticket: requireStillOpen(scope.ticket) }, actor, candidates),
  );
}

async function addLocked(
  client: Client<true>,
  scope: TicketScope,
  actor: GuildMember,
  candidates: Candidate[],
): Promise<ParticipantChange> {
  const { ticket, server } = scope;
  const channel = await requireClientChannel(client, scope);
  const current = new Set(getParticipantIds(ticket.id));
  let slots = remainingParticipantSlots(server.maxParticipants, current.size);
  const result: ParticipantChange = { changed: [], skipped: [] };

  for (const { user, member } of candidates) {
    const person = personOf(user, member);
    const reason =
      participantRejection({
        isMember: member !== null,
        isBot: user.bot,
        isActor: user.id === actor.id,
        isOpener: user.id === ticket.openerId,
        isParticipant: current.has(user.id),
        isStaff: member !== null && isClientStaff(member, server),
        isBlacklisted: isBlacklisted(user.id, server.guildId),
      }) ?? (slots > 0 ? null : 'does not fit, the ticket is full');
    if (reason) {
      result.skipped.push({ person, reason });
      continue;
    }
    try {
      await grantTicketAccess(channel, user.id);
      result.changed.push(person);
      slots -= 1;
    } catch (error) {
      logger.warn(`Failed to add ${user.id} to ticket ${ticket.id}`, error);
      result.skipped.push({ person, reason: 'could not be added' });
    }
  }

  const addedIds = result.changed.map((person) => person.id);
  addParticipantRows(ticket.id, addedIds, actor.id);
  if (addedIds.length > 0) {
    await postTicketNotice(client, ticket, {
      client: `${userMention(actor.id)} added ${mentionList(result.changed)} to the ticket.`,
      hub: `${plainName(actor.displayName)} added ${nameList(result.changed)} to the ticket.`,
      pingUserIds: addedIds,
    });
    await refreshStarterMessages(client, ticket);
  }
  return result;
}

export function removeParticipants(
  client: Client<true>,
  scope: TicketScope,
  actor: GuildMember,
  people: PersonRef[],
): Promise<ParticipantChange> {
  return withTicketLock(scope.ticket.id, () =>
    removeLocked(client, { ...scope, ticket: requireStillOpen(scope.ticket) }, actor, people),
  );
}

async function removeLocked(
  client: Client<true>,
  scope: TicketScope,
  actor: GuildMember,
  people: PersonRef[],
): Promise<ParticipantChange> {
  const { ticket } = scope;
  const channel = await requireClientChannel(client, scope);
  const current = new Set(getParticipantIds(ticket.id));
  const result: ParticipantChange = { changed: [], skipped: [] };

  for (const person of people) {
    if (person.id === ticket.openerId) {
      result.skipped.push({ person, reason: 'opened this ticket' });
      continue;
    }
    if (!current.has(person.id)) {
      result.skipped.push({ person, reason: 'is not in this ticket' });
      continue;
    }
    try {
      await revokeTicketAccess(channel, person.id);
      result.changed.push(person);
    } catch (error) {
      logger.warn(`Failed to remove ${person.id} from ticket ${ticket.id}`, error);
      result.skipped.push({ person, reason: 'could not be removed' });
    }
  }

  removeParticipantRows(
    ticket.id,
    result.changed.map((person) => person.id),
  );
  if (result.changed.length > 0) {
    await postTicketNotice(client, ticket, {
      client: `${userMention(actor.id)} removed ${mentionList(result.changed)} from the ticket.`,
      hub: `${plainName(actor.displayName)} removed ${nameList(result.changed)} from the ticket.`,
    });
    await refreshStarterMessages(client, ticket);
  }
  return result;
}

/** For example "Added Ana.\nNot added: Bo is a bot." */
export function describeChange(verb: 'Added' | 'Removed', change: ParticipantChange): string {
  const lines: string[] = [];
  if (change.changed.length > 0) lines.push(`${verb} ${nameList(change.changed)}.`);
  if (change.skipped.length > 0) {
    const skipped = change.skipped.map(
      ({ person, reason }) => `${plainName(person.name)} ${reason}`,
    );
    lines.push(`Not ${verb.toLowerCase()}: ${skipped.join('; ')}.`);
  }
  return lines.join('\n') || 'Nothing changed.';
}

/** A close that ran while this change waited for the lock has already locked the channel. */
function requireStillOpen(ticket: Ticket): Ticket {
  const current = getTicket(ticket.id);
  if (!current) throw new UserFacingError('This ticket no longer exists.');
  requireOpen(current);
  return current;
}

async function requireClientChannel(client: Client<true>, scope: TicketScope) {
  const channel = await fetchTicketChannel(client, scope.ticket.clientChannelId);
  if (!channel) throw new UserFacingError('The ticket channel is gone.');
  return channel;
}

function mentionList(people: PersonRef[]): string {
  return people.map((person) => userMention(person.id)).join(', ');
}

function nameList(people: PersonRef[]): string {
  return people.map((person) => plainName(person.name)).join(', ');
}

function plainName(name: string): string {
  return `**${escapeMarkdown(name)}**`;
}

export async function resolvePerson(
  client: Client<true>,
  guildId: string,
  userId: string,
): Promise<PersonRef> {
  const member = await client.guilds.cache
    .get(guildId)
    ?.members.fetch(userId)
    .catch(() => null);
  if (member) return { id: userId, name: member.displayName };
  const user = await client.users.fetch(userId).catch(() => null);
  return { id: userId, name: user?.displayName ?? userId };
}
