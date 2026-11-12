import { MessageType } from 'discord.js';
import type { TicketSide } from '../db/schema.js';

const RELAYED_TYPES: ReadonlySet<MessageType> = new Set([MessageType.Default, MessageType.Reply]);

export interface SourceMessageShape {
  webhookId: string | null;
  author: { bot: boolean };
  system: boolean;
  type: MessageType;
}

/**
 * Only plain messages and replies from people are relayed. Webhook messages
 * are skipped, which also keeps relayed copies from being relayed back.
 */
export function isRelayableSource(message: SourceMessageShape): boolean {
  return (
    message.webhookId === null &&
    !message.author.bot &&
    !message.system &&
    RELAYED_TYPES.has(message.type)
  );
}

export function isHubNote(side: TicketSide, content: string, notePrefix: string): boolean {
  return side === 'hub' && notePrefix.length > 0 && content.startsWith(notePrefix);
}
