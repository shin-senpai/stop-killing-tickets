import { StickerFormatType } from 'discord.js';

export const OFFLINE_NOTE = '-# sent while the bridge was offline';

export interface RelayContentParts {
  replyQuote: string | undefined;
  body: string;
  /** Sticker and oversized attachment lines, shown after the body. */
  extraLines: string[];
  offline: boolean;
}

export function composeRelayContent(parts: RelayContentParts): string {
  return [parts.replyQuote, parts.body, ...parts.extraLines, parts.offline ? OFFLINE_NOTE : '']
    .filter((part) => part !== undefined && part.length > 0)
    .join('\n');
}

export interface StickerInfo {
  name: string;
  format: StickerFormatType;
  url: string;
}

/** Lottie stickers are animation data, not images, so they are shown by name. */
export function stickerLine(sticker: StickerInfo): string {
  return sticker.format === StickerFormatType.Lottie ? `[sticker: ${sticker.name}]` : sticker.url;
}
