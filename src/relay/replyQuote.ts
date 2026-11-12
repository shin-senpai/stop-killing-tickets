import { messageLink, MessageType, type Message, type TextChannel } from 'discord.js';
import { mentionNamesFor } from './mentionNames.js';
import { rewriteMentions } from './mentions.js';
import { buildReplyQuote } from './quote.js';
import { findCopies, findLinkByCopy } from './repo.js';

/**
 * The quote line for a reply, or undefined when the message is not a reply in
 * the same channel. Webhooks cannot send real replies.
 */
export async function resolveReplyQuote(
  message: Message<true>,
  target: TextChannel,
): Promise<string | undefined> {
  if (message.type !== MessageType.Reply) return undefined;
  if (message.reference?.channelId !== message.channelId) return undefined;

  const referenced = await message.fetchReference().catch(() => undefined);
  if (!referenced?.inGuild()) return undefined;

  const targetMessageId = counterpartId(referenced.id);
  return buildReplyQuote({
    authorName: authorName(referenced),
    content: rewriteMentions(referenced.content, mentionNamesFor(referenced)),
    jumpUrl: targetMessageId ? messageLink(target.id, targetMessageId, target.guildId) : undefined,
  });
}

/** The message in the other channel that matches this one: its copy, or its source if it is a copy. */
function counterpartId(messageId: string): string | undefined {
  return findCopies(messageId)[0]?.copyMessageId ?? findLinkByCopy(messageId)?.sourceMessageId;
}

function authorName(message: Message<true>): string {
  if (message.webhookId) return message.author.username;
  return message.member?.displayName ?? message.author.displayName;
}
