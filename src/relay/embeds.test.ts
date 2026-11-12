import { EmbedType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { authorEmbeds } from './embeds.js';

describe('authorEmbeds', () => {
  it('keeps rich embeds', () => {
    const embed = { type: EmbedType.Rich, title: 'Report' };
    expect(authorEmbeds([embed], 'text')).toEqual([embed]);
  });

  it('drops link previews', () => {
    expect(authorEmbeds([{ type: EmbedType.Link, url: 'https://a' }], 'https://a')).toEqual([]);
    expect(authorEmbeds([{ type: EmbedType.Rich, url: 'https://a' }], 'see https://a')).toEqual([]);
  });
});
