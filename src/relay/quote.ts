import { escapeMarkdown } from 'discord.js';
import { truncate } from '../core/text.js';
import { OFFLINE_NOTE } from './content.js';

const QUOTE_PREFIX = '> ↪ ';
const EXCERPT_LENGTH = 80;

export interface ReplyQuote {
  authorName: string;
  content: string;
  /** Link to the message in the target channel, when it was relayed. */
  jumpUrl: string | undefined;
}

export function buildReplyQuote(quote: ReplyQuote): string {
  const excerpt = quoteExcerpt(quote.content);
  const text = `${QUOTE_PREFIX}Replying to **${escapeMarkdown(quote.authorName)}**${excerpt ? `: ${excerpt}` : ''}`;
  return quote.jumpUrl ? `${text} [↗](${quote.jumpUrl})` : text;
}

/**
 * A one-line excerpt of a message. Lines the relay added itself (an earlier
 * reply quote or the offline note) are left out.
 */
export function quoteExcerpt(content: string): string {
  const text = content
    .split('\n')
    .filter((line) => !line.startsWith(QUOTE_PREFIX) && line !== OFFLINE_NOTE)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, EXCERPT_LENGTH);
}
