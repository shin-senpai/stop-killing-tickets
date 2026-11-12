import { describe, expect, it } from 'vitest';
import { OFFLINE_NOTE } from './content.js';
import { buildReplyQuote, quoteExcerpt } from './quote.js';

describe('buildReplyQuote', () => {
  it('quotes the author and text with a jump link', () => {
    expect(
      buildReplyQuote({ authorName: 'Bob', content: 'hello there', jumpUrl: 'https://jump' }),
    ).toBe('> ↪ Replying to **Bob**: hello there [↗](https://jump)');
  });

  it('works without a link or text', () => {
    expect(buildReplyQuote({ authorName: 'Bob', content: '', jumpUrl: undefined })).toBe(
      '> ↪ Replying to **Bob**',
    );
  });

  it('escapes markdown in the name', () => {
    expect(buildReplyQuote({ authorName: '*Bob*', content: '', jumpUrl: undefined })).toBe(
      '> ↪ Replying to **\\*Bob\\***',
    );
  });
});

describe('quoteExcerpt', () => {
  it('joins lines and collapses spaces', () => {
    expect(quoteExcerpt('one\n\ntwo   three')).toBe('one two three');
  });

  it('cuts long text to 80 characters', () => {
    const excerpt = quoteExcerpt('x'.repeat(200));
    expect(excerpt).toHaveLength(80);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('drops lines the relay added', () => {
    expect(quoteExcerpt(`> ↪ Replying to **A**: hi\nreal text\n${OFFLINE_NOTE}`)).toBe('real text');
  });
});
