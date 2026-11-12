import type { Attachment, Message, TextChannel } from 'discord.js';
import { composeRelayContent, stickerLine } from './content.js';
import { mentionNamesFor } from './mentionNames.js';
import { rewriteMentions } from './mentions.js';
import { resolveReplyQuote } from './replyQuote.js';
import { splitUploads, uploadLimitBytes } from './uploads.js';

export interface RenderOptions {
  /** Attachments shown as links instead of uploaded files. */
  linkedAttachments: readonly Attachment[];
  offline: boolean;
}

/** The full text of a relayed message, before it is split into chunks. */
export async function renderRelayContent(
  message: Message<true>,
  target: TextChannel,
  options: RenderOptions,
): Promise<string> {
  return composeRelayContent({
    replyQuote: await resolveReplyQuote(message, target),
    body: rewriteMentions(message.content, mentionNamesFor(message)),
    extraLines: [
      ...message.stickers.map(stickerLine),
      ...options.linkedAttachments.map((attachment) => attachment.url),
    ],
    offline: options.offline,
  });
}

export function splitAttachmentsFor(
  message: Message<true>,
  target: TextChannel,
): { upload: Attachment[]; link: Attachment[] } {
  return splitUploads(
    [...message.attachments.values()],
    uploadLimitBytes(target.guild.premiumTier),
  );
}
