import { describe, expect, it } from 'vitest';
import {
  chunkText,
  padTicketNumber,
  sanitizeWebhookUsername,
  toChannelSlug,
  truncate,
} from './text.js';

describe('truncate', () => {
  it('keeps short text', () => expect(truncate('abc', 5)).toBe('abc'));
  it('adds an ellipsis inside the limit', () => expect(truncate('abcdef', 4)).toBe('abc…'));
});

describe('chunkText', () => {
  it('returns one chunk for short text', () => expect(chunkText('hello', 10)).toEqual(['hello']));
  it('returns one empty chunk for empty text', () => expect(chunkText('', 10)).toEqual(['']));

  it('splits at a space', () => {
    expect(chunkText('aaaa bbbb cccc', 10)).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('splits at a newline before a space', () => {
    expect(chunkText('aaaaaa\nbb cc dd', 12)).toEqual(['aaaaaa', 'bb cc dd']);
  });

  it('hard-splits text with no break points', () => {
    expect(chunkText('a'.repeat(25), 10)).toEqual(['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  });

  it('never returns a chunk over the limit', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    for (const chunk of chunkText(text, 2000)) expect(chunk.length).toBeLessThanOrEqual(2000);
  });
});

describe('sanitizeWebhookUsername', () => {
  it('breaks up reserved words', () => {
    expect(sanitizeWebhookUsername('Discord Fan')).toBe('Disc0rd Fan');
    expect(sanitizeWebhookUsername('clyde')).toBe('c1yde');
  });
  it('rejects bare everyone and here', () => expect(sanitizeWebhookUsername('here')).toBe('here_'));
  it('replaces empty names', () => expect(sanitizeWebhookUsername('  ')).toBe('Unknown'));
  it('limits length to 80', () =>
    expect(sanitizeWebhookUsername('x'.repeat(100))).toHaveLength(80));
});

describe('padTicketNumber', () => {
  it('pads to four digits', () => expect(padTicketNumber(42)).toBe('0042'));
});

describe('toChannelSlug', () => {
  it('makes a channel-safe name', () => expect(toChannelSlug('Jöhn Doe!!')).toBe('john-doe'));
  it('falls back when nothing is left', () => expect(toChannelSlug('✨✨')).toBe('user'));
});
