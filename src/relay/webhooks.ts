import type { APIMessage, Client, TextChannel, WebhookMessageCreateOptions } from 'discord.js';
import { logger } from '../core/logger.js';
import { getTicket, updateTicket } from '../db/queries.js';
import type { Ticket, TicketSide } from '../db/schema.js';
import { isMissingWebhookError, isUnknownMessageError } from '../core/discordErrors.js';
import { fetchTicketChannel } from './channels.js';
import { channelIdOf, webhookChanges, webhookOf, type WebhookCredentials } from './sides.js';
import { forgetWebhookClient, webhookClient } from './webhookClients.js';

const WEBHOOK_NAME = 'Ticket Bridge';

/** Replaces the ticket's webhook on `side` once if it was deleted, then retries. */
export async function sendWithWebhook(
  discord: Client<true>,
  ticketId: number,
  side: TicketSide,
  payload: WebhookMessageCreateOptions,
): Promise<APIMessage> {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} does not exist`);

  const current = webhookOf(ticket, side);
  if (current) {
    try {
      return await webhookClient(current).send(payload);
    } catch (error) {
      if (!isMissingWebhookError(error)) throw error;
      forgetWebhookClient(current.id);
    }
  }
  const replacement = await replaceWebhook(discord, ticket, side);
  return webhookClient(replacement).send(payload);
}

async function replaceWebhook(
  discord: Client<true>,
  ticket: Ticket,
  side: TicketSide,
): Promise<WebhookCredentials> {
  const channel = await fetchTicketChannel(discord, channelIdOf(ticket, side));
  if (!channel) throw new Error(`Ticket ${ticket.id} has no ${side} channel`);

  const credentials = await createRelayWebhook(
    channel,
    `Relay webhook for ticket ${ticket.id} was missing`,
  );
  updateTicket(ticket.id, webhookChanges(side, credentials));
  logger.warn(`Replaced the missing ${side} webhook of ticket ${ticket.id}`);
  return credentials;
}

export async function createRelayWebhook(
  channel: TextChannel,
  reason?: string,
): Promise<WebhookCredentials> {
  const webhook = await channel.createWebhook({ name: WEBHOOK_NAME, reason });
  if (!webhook.token) throw new Error(`Webhook in ${channel.id} has no token`);
  return { id: webhook.id, token: webhook.token };
}

/** Returns false when the copy can no longer be edited (deleted, or made by a replaced webhook). */
export async function editCopy(
  ticket: Ticket,
  side: TicketSide,
  copyMessageId: string,
  content: string,
): Promise<boolean> {
  const credentials = webhookOf(ticket, side);
  if (!credentials) return false;
  try {
    await webhookClient(credentials).editMessage(copyMessageId, {
      content,
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    if (isMissingWebhookError(error)) forgetWebhookClient(credentials.id);
    else if (!isUnknownMessageError(error)) throw error;
    return false;
  }
}

export async function deleteCopy(
  discord: Client<true>,
  ticket: Ticket,
  side: TicketSide,
  copyMessageId: string,
): Promise<void> {
  const credentials = webhookOf(ticket, side);
  if (credentials) {
    try {
      await webhookClient(credentials).deleteMessage(copyMessageId);
      return;
    } catch (error) {
      if (isMissingWebhookError(error)) forgetWebhookClient(credentials.id);
      else if (!isUnknownMessageError(error)) throw error;
    }
  }
  // A webhook can only delete its own messages. Copies made by a webhook that
  // was since replaced are deleted by the bot instead (needs Manage Messages).
  const channel = await fetchTicketChannel(discord, channelIdOf(ticket, side));
  await channel?.messages.delete(copyMessageId).catch((error: unknown) => {
    if (!isUnknownMessageError(error)) throw error;
  });
}
