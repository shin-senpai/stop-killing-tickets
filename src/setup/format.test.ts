import type { Client } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { serverName } from './format.js';

function clientWithGuilds(guilds: Record<string, string>): Client<true> {
  const cache = new Map(Object.entries(guilds).map(([id, name]) => [id, { name }]));
  return { guilds: { cache } } as unknown as Client<true>;
}

describe('serverName', () => {
  it('prefers the live name', () =>
    expect(serverName(clientWithGuilds({ '1': 'Acme' }), { guildId: '1', name: 'Old' })).toBe(
      'Acme',
    ));
  it('uses the stored name after the bot left', () =>
    expect(serverName(clientWithGuilds({}), { guildId: '1', name: 'Acme' })).toBe('Acme'));
  it('falls back to the ID', () =>
    expect(serverName(clientWithGuilds({}), { guildId: '1', name: null })).toBe(
      'Unknown server (1)',
    ));
});
