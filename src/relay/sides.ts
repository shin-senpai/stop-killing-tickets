import type { Ticket, TicketSide } from '../db/schema.js';

export interface WebhookCredentials {
  id: string;
  token: string;
}

export function otherSide(side: TicketSide): TicketSide {
  return side === 'client' ? 'hub' : 'client';
}

export function channelIdOf(ticket: Ticket, side: TicketSide): string | null {
  return side === 'client' ? ticket.clientChannelId : ticket.hubChannelId;
}

export function webhookOf(ticket: Ticket, side: TicketSide): WebhookCredentials | undefined {
  const id = side === 'client' ? ticket.clientWebhookId : ticket.hubWebhookId;
  const token = side === 'client' ? ticket.clientWebhookToken : ticket.hubWebhookToken;
  return id && token ? { id, token } : undefined;
}

export function webhookChanges(side: TicketSide, webhook: WebhookCredentials): Partial<Ticket> {
  return side === 'client'
    ? { clientWebhookId: webhook.id, clientWebhookToken: webhook.token }
    : { hubWebhookId: webhook.id, hubWebhookToken: webhook.token };
}

export function lastRelayedOf(ticket: Ticket, side: TicketSide): string | null {
  return side === 'client' ? ticket.lastRelayedClientMessageId : ticket.lastRelayedHubMessageId;
}

export function lastRelayedChanges(side: TicketSide, messageId: string): Partial<Ticket> {
  return side === 'client'
    ? { lastRelayedClientMessageId: messageId }
    : { lastRelayedHubMessageId: messageId };
}
