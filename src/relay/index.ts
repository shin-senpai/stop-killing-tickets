import { Events, type Client, type Message, type PartialMessage } from 'discord.js';
import { logger } from '../core/logger.js';
import type { BotModule } from '../core/module.js';
import { scheduleCatchUp } from './catchUp.js';
import { handleSourceMessage } from './create.js';
import { relayDeletion } from './delete.js';
import { relayEdit } from './edit.js';
import { isRelayableSource } from './filters.js';
import { KeyedSerialQueue } from '../core/serialQueue.js';
import { findRelayedTicketByChannel } from './repo.js';

const queue = new KeyedSerialQueue<number>();

function enqueue(ticketId: number, action: string, job: () => Promise<void>): void {
  queue
    .run(ticketId, job)
    .catch((error: unknown) => logger.error(`Relay ${action} failed in ticket ${ticketId}`, error));
}

function onMessageCreate(message: Message): void {
  if (!message.inGuild() || !isRelayableSource(message)) return;
  const location = findRelayedTicketByChannel(message.channelId);
  if (!location) return;
  const { ticket, side } = location;
  enqueue(ticket.id, 'create', () =>
    handleSourceMessage(message, ticket.id, side, { offline: false }),
  );
}

function onMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message): void {
  if (newMessage.webhookId) return;
  const location = findRelayedTicketByChannel(newMessage.channelId);
  if (!location) return;
  const { ticket, side } = location;
  enqueue(ticket.id, 'edit', async () => {
    const message = newMessage.partial ? await newMessage.fetch() : newMessage;
    if (!message.inGuild() || !isRelayableSource(message)) return;
    // Discord also sends updates when it adds link previews; the text is unchanged then.
    if (!oldMessage.partial && oldMessage.content === message.content) return;
    await relayEdit(message, ticket.id, side);
  });
}

function onMessageDelete(discord: Client<true>, channelId: string, messageId: string): void {
  const location = findRelayedTicketByChannel(channelId);
  if (!location) return;
  enqueue(location.ticket.id, 'delete', () => relayDeletion(discord, messageId));
}

export const relayModule: BotModule = {
  name: 'relay',
  register(client) {
    // Not onReady: that runs after command sync, and live messages queued
    // before catch-up would move the "last relayed" markers past missed ones.
    client.once(Events.ClientReady, (ready) => scheduleCatchUp(ready, queue));
    client.on(Events.MessageCreate, onMessageCreate);
    client.on(Events.MessageUpdate, onMessageUpdate);
    client.on(Events.MessageDelete, (message) =>
      onMessageDelete(message.client, message.channelId, message.id),
    );
    client.on(Events.MessageBulkDelete, (messages, channel) => {
      for (const id of messages.keys()) onMessageDelete(channel.client, channel.id, id);
    });
  },
};
