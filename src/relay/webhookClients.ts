import { WebhookClient } from 'discord.js';
import type { WebhookCredentials } from './sides.js';

const MAX_CACHED = 200;
const clients = new Map<string, WebhookClient>();

/** A cached client per webhook. The least recently used one is dropped when the cache is full. */
export function webhookClient(credentials: WebhookCredentials): WebhookClient {
  const cached = clients.get(credentials.id);
  clients.delete(credentials.id);
  if (cached?.token === credentials.token) {
    clients.set(credentials.id, cached);
    return cached;
  }
  cached?.destroy();

  const client = new WebhookClient(credentials, { allowedMentions: { parse: [] } });
  clients.set(credentials.id, client);
  evictOverflow();
  return client;
}

export function forgetWebhookClient(webhookId: string): void {
  clients.get(webhookId)?.destroy();
  clients.delete(webhookId);
}

function evictOverflow(): void {
  for (const id of clients.keys()) {
    if (clients.size <= MAX_CACHED) return;
    forgetWebhookClient(id);
  }
}
