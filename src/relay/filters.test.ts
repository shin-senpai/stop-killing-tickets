import { MessageType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { isHubNote, isRelayableSource, type SourceMessageShape } from './filters.js';

const userMessage: SourceMessageShape = {
  webhookId: null,
  author: { bot: false },
  system: false,
  type: MessageType.Default,
};

describe('isRelayableSource', () => {
  it('accepts plain messages and replies', () => {
    expect(isRelayableSource(userMessage)).toBe(true);
    expect(isRelayableSource({ ...userMessage, type: MessageType.Reply })).toBe(true);
  });

  it('rejects webhook, bot and system messages', () => {
    expect(isRelayableSource({ ...userMessage, webhookId: '1' })).toBe(false);
    expect(isRelayableSource({ ...userMessage, author: { bot: true } })).toBe(false);
    expect(isRelayableSource({ ...userMessage, system: true })).toBe(false);
    expect(isRelayableSource({ ...userMessage, type: MessageType.ChannelPinnedMessage })).toBe(
      false,
    );
  });
});

describe('isHubNote', () => {
  it('matches the prefix on the hub side only', () => {
    expect(isHubNote('hub', '// internal', '//')).toBe(true);
    expect(isHubNote('client', '// internal', '//')).toBe(false);
    expect(isHubNote('hub', 'hello', '//')).toBe(false);
  });

  it('never matches an empty prefix', () => expect(isHubNote('hub', 'hello', '')).toBe(false));
});
