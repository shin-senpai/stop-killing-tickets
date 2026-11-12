import { StickerFormatType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { composeRelayContent, OFFLINE_NOTE, stickerLine } from './content.js';

describe('composeRelayContent', () => {
  it('joins the parts in order', () => {
    expect(
      composeRelayContent({
        replyQuote: '> quote',
        body: 'hello',
        extraLines: ['https://cdn/file.zip'],
        offline: true,
      }),
    ).toBe(`> quote\nhello\nhttps://cdn/file.zip\n${OFFLINE_NOTE}`);
  });

  it('skips empty parts', () => {
    expect(
      composeRelayContent({ replyQuote: undefined, body: '', extraLines: ['x'], offline: false }),
    ).toBe('x');
  });

  it('returns an empty string when there is nothing to say', () => {
    expect(
      composeRelayContent({ replyQuote: undefined, body: '', extraLines: [], offline: false }),
    ).toBe('');
  });
});

describe('stickerLine', () => {
  it('posts the image URL', () => {
    expect(
      stickerLine({ name: 'wave', format: StickerFormatType.PNG, url: 'https://s/1.png' }),
    ).toBe('https://s/1.png');
  });

  it('names Lottie stickers', () => {
    expect(stickerLine({ name: 'wave', format: StickerFormatType.Lottie, url: 'x' })).toBe(
      '[sticker: wave]',
    );
  });
});
