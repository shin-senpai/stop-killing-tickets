import { userMention, type Client, type GuildMember } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { getTicket, updateTicket } from '../db/queries.js';
import {
  isTicketStaff,
  requireOpen,
  requireSide,
  requireStaff,
  type TicketScope,
} from './access.js';
import { resolveStaffLabel } from '../core/staffIdentity.js';
import { postTicketNotice, type TicketNotice } from './notices.js';
import { refreshStarterMessages } from './starter.js';
import { withTicketLock } from './ticketLock.js';

export async function claimTicket(
  client: Client<true>,
  scope: TicketScope,
  staff: GuildMember,
): Promise<void> {
  requireHubStaffOnOpenTicket(staff, scope);
  const previous = scope.ticket.claimedBy;
  if (previous === staff.id) {
    throw new UserFacingError('You already claimed this ticket. Use `/ticket unclaim` to let go.');
  }
  await setClaim(client, scope, staff.id, {
    hub: previous
      ? `${userMention(staff.id)} took over the ticket from ${userMention(previous)}.`
      : `${userMention(staff.id)} claimed the ticket.`,
    client: `${await resolveStaffLabel(client, staff.id)} is now helping you.`,
  });
}

export async function unclaimTicket(
  client: Client<true>,
  scope: TicketScope,
  staff: GuildMember,
): Promise<void> {
  requireHubStaffOnOpenTicket(staff, scope);
  if (!scope.ticket.claimedBy) throw new UserFacingError('This ticket is not claimed.');
  await setClaim(client, scope, null, {
    hub: `${userMention(staff.id)} unclaimed the ticket.`,
    client: 'Your ticket is waiting for the support team again.',
  });
}

export async function transferTicket(
  client: Client<true>,
  scope: TicketScope,
  staff: GuildMember,
  target: GuildMember,
): Promise<void> {
  requireHubStaffOnOpenTicket(staff, scope);
  if (target.user.bot || !isTicketStaff(target, scope)) {
    throw new UserFacingError(`${target.displayName} is not staff for this ticket.`);
  }
  if (scope.ticket.claimedBy === target.id) {
    throw new UserFacingError(`${target.displayName} already has this ticket.`);
  }
  await setClaim(client, scope, target.id, {
    hub: `${userMention(staff.id)} gave the ticket to ${userMention(target.id)}.`,
    client: `${await resolveStaffLabel(client, target.id)} is now helping you.`,
  });
}

function requireHubStaffOnOpenTicket(member: GuildMember, scope: TicketScope): void {
  requireSide(scope, 'hub');
  requireStaff(member, scope);
  requireOpen(scope.ticket);
}

function setClaim(
  client: Client<true>,
  scope: TicketScope,
  claimedBy: string | null,
  notice: TicketNotice,
): Promise<void> {
  return withTicketLock(scope.ticket.id, async () => {
    const current = getTicket(scope.ticket.id);
    if (!current) throw new UserFacingError('This ticket no longer exists.');
    requireOpen(current);
    const ticket = updateTicket(current.id, { claimedBy }) ?? current;
    await refreshStarterMessages(client, ticket);
    await postTicketNotice(client, ticket, notice);
  });
}
