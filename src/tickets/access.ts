import type { GuildMember } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { isClientStaff, isHubStaff } from '../core/staff.js';
import { findTicketByChannel, getClientServer, getHubConfig, getTicket } from '../db/queries.js';
import type { ClientServer, Ticket, TicketSide } from '../db/schema.js';
import { getOpenTicketsOfOpener } from './repo.js';

export interface TicketScope {
  ticket: Ticket;
  side: TicketSide;
  server: ClientServer;
}

export function ticketInChannel(channelId: string): TicketScope {
  const location = findTicketByChannel(channelId);
  if (!location) throw new UserFacingError('Use this inside a ticket channel.');
  return { ...location, server: requireServer(location.ticket) };
}

/** Also checks that the component is in one of the ticket's channels. */
export function ticketFromComponent(
  ticketIdArg: string | undefined,
  channelId: string,
): TicketScope {
  const ticket = getTicket(Number(ticketIdArg));
  const side: TicketSide | null =
    ticket?.clientChannelId === channelId
      ? 'client'
      : ticket?.hubChannelId === channelId
        ? 'hub'
        : null;
  if (!ticket || !side) throw new UserFacingError('This ticket is no longer active.');
  return { ticket, side, server: requireServer(ticket) };
}

export function isTicketStaff(member: GuildMember, scope: TicketScope): boolean {
  return scope.side === 'hub'
    ? isHubStaff(member, getHubConfig(), scope.ticket.hubChannelId ?? undefined)
    : isClientStaff(member, scope.server);
}

export function requireStaff(member: GuildMember, scope: TicketScope): void {
  if (!isTicketStaff(member, scope)) throw new UserFacingError('Only staff can do this.');
}

/** Participants may not close or reopen. */
export function requireCanCloseOrReopen(member: GuildMember, scope: TicketScope): void {
  const isOpener = scope.side === 'client' && member.id === scope.ticket.openerId;
  if (!isOpener && !isTicketStaff(member, scope)) {
    throw new UserFacingError('Only the person who opened this ticket or staff can do this.');
  }
}

/**
 * The open-ticket limit only counts open tickets, so without this check an
 * opener could open a new ticket during the grace period and then reopen the old one.
 */
export function requireReopenWithinLimit(member: GuildMember, scope: TicketScope): void {
  if (isTicketStaff(member, scope)) return;
  const { ticket, server } = scope;
  if (
    getOpenTicketsOfOpener(ticket.clientGuildId, ticket.openerId).length >= server.maxOpenTickets
  ) {
    throw new UserFacingError(
      'You already have an open ticket. Close it before you reopen this one.',
    );
  }
}

export function requireOpen(ticket: Ticket): void {
  if (ticket.status !== 'open') throw new UserFacingError('This ticket is closed.');
}

export function requireSide(scope: TicketScope, side: TicketSide): void {
  if (scope.side === side) return;
  throw new UserFacingError(
    side === 'hub'
      ? 'This only works in the support team server.'
      : 'This only works in the ticket channel of the community server.',
  );
}

function requireServer(ticket: Ticket): ClientServer {
  const server = getClientServer(ticket.clientGuildId);
  if (!server) throw new UserFacingError('This ticket is no longer active.');
  return server;
}
