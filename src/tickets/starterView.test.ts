import { describe, expect, it } from 'vitest';
import type { Ticket } from '../db/schema.js';
import {
  clientStatus,
  hubStatus,
  renderClientStarter,
  renderHubStarter,
  type StarterContext,
} from './starterView.js';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 7,
    clientGuildId: '100',
    number: 42,
    openerId: '200',
    subject: 'My payment failed',
    status: 'open',
    clientChannelId: '300',
    clientWebhookId: null,
    clientWebhookToken: null,
    clientStarterMessageId: null,
    hubChannelId: '400',
    hubWebhookId: null,
    hubWebhookToken: null,
    hubStarterMessageId: null,
    claimedBy: null,
    createdAt: new Date(0),
    lastOpenerActivityAt: null,
    lastStaffActivityAt: null,
    autoCloseWarnedAt: null,
    closingUntil: null,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    lastRelayedClientMessageId: null,
    lastRelayedHubMessageId: null,
    ...overrides,
  };
}

function makeContext(ticket: Ticket, overrides: Partial<StarterContext> = {}): StarterContext {
  return {
    ticket,
    tag: 'acme',
    serverName: 'Acme',
    serverIconUrl: null,
    opener: { id: '200', username: 'user', createdAt: new Date(0), joinedAt: new Date(0) },
    history: { priorCount: 0, lastClosedAt: null },
    participantIds: [],
    helperLabel: null,
    ...overrides,
  };
}

function customIds(message: ReturnType<typeof renderClientStarter>): string[] {
  return message.components.flatMap((row) =>
    row.components.map((button) => (button.toJSON() as { custom_id: string }).custom_id),
  );
}

describe('status lines', () => {
  it('shows who helps the user', () => {
    expect(clientStatus(makeTicket(), null)).toBe('🟢 Open · Waiting for support');
    expect(clientStatus(makeTicket({ claimedBy: '9' }), 'Bob')).toBe(
      '🟢 Open · Bob is helping you',
    );
  });

  it('shows the claim on the hub side', () => {
    expect(hubStatus(makeTicket())).toBe('🟢 Open · Unclaimed');
    expect(hubStatus(makeTicket({ claimedBy: '9' }))).toBe('🟢 Open · Claimed by <@9>');
  });

  it('shows closed tickets the same on both sides', () => {
    const ticket = makeTicket({ status: 'closed' });
    expect(hubStatus(ticket)).toBe('⚫ Closed');
    expect(clientStatus(ticket, 'Bob')).toBe('⚫ Closed');
  });
});

describe('starter buttons', () => {
  it('offers add people and close on an open client ticket', () => {
    expect(customIds(renderClientStarter(makeContext(makeTicket())))).toEqual([
      'ticketAddPeople:7',
      'ticketClose:7',
    ]);
  });

  it('offers claim, close and info on an open hub ticket', () => {
    expect(customIds(renderHubStarter(makeContext(makeTicket())))).toEqual([
      'ticketClaim:7',
      'ticketClose:7',
      'ticketInfo:7',
    ]);
  });

  it('offers reopen while closing', () => {
    const ticket = makeTicket({ status: 'closing' });
    expect(customIds(renderClientStarter(makeContext(ticket)))).toEqual(['ticketReopen:7']);
    expect(customIds(renderHubStarter(makeContext(ticket)))).toEqual([
      'ticketReopen:7',
      'ticketInfo:7',
    ]);
  });

  it('offers only info once closed for good', () => {
    const ticket = makeTicket({ status: 'closed' });
    expect(customIds(renderClientStarter(makeContext(ticket)))).toEqual([]);
    expect(customIds(renderHubStarter(makeContext(ticket)))).toEqual(['ticketInfo:7']);
  });
});

function fieldValue(embed: { fields?: { name: string; value: string }[] }, name: string) {
  return embed.fields?.find((field) => field.name === name)?.value;
}

describe('hub starter embed', () => {
  it('shows the server once, a short title and the subject as a quote', () => {
    const embed = renderHubStarter(
      makeContext(makeTicket({ subject: 'Line *one*\nline two' })),
    ).embeds[0]!.toJSON();
    expect(embed.author?.name).toBe('Acme');
    expect(embed.title).toBe('Ticket #0042');
    expect(embed.description).toBe('> Line \\*one\\*\n> line two');
  });

  it('keeps a long subject within the description limit', () => {
    const embed = renderHubStarter(
      makeContext(makeTicket({ subject: 'a\n'.repeat(5000) })),
    ).embeds[0]!.toJSON();
    expect(embed.description!.length).toBeLessThanOrEqual(4096);
  });

  it('puts the opener data in inline fields and the user ID in the footer', () => {
    const embed = renderHubStarter(makeContext(makeTicket())).embeds[0]!.toJSON();
    expect(embed.fields?.map((f) => [f.name, f.inline])).toEqual([
      ['Opener', true],
      ['Account created', true],
      ['Joined server', true],
      ['Prior tickets', true],
      ['Status', true],
    ]);
    expect(fieldValue(embed, 'Opener')).toBe('<@200>\nuser');
    expect(fieldValue(embed, 'Prior tickets')).toBe('None');
    expect(embed.footer?.text).toBe('User ID: 200');
  });

  it('lists prior tickets and participants', () => {
    const context = makeContext(makeTicket(), {
      history: { priorCount: 2, lastClosedAt: new Date(1000) },
      participantIds: ['5', '6'],
    });
    const embed = renderHubStarter(context).embeds[0]!.toJSON();
    expect(fieldValue(embed, 'Prior tickets')).toBe('2\nLast closed <t:1:R>');
    expect(fieldValue(embed, 'Participants')).toBe('<@5>, <@6>');
  });

  it('notes when the opener left', () => {
    const context = makeContext(makeTicket(), {
      opener: { id: '200', username: 'user', createdAt: new Date(0), joinedAt: null },
    });
    const embed = renderHubStarter(context).embeds[0]!.toJSON();
    expect(fieldValue(embed, 'Joined server')).toBe('Not in the server anymore');
  });
});

describe('client starter embed', () => {
  it('shows number, subject, opener, time and status', () => {
    const embed = renderClientStarter(makeContext(makeTicket())).embeds[0]!.toJSON();
    expect(embed.title).toBe('Ticket #0042');
    expect(embed.description).toBe('> My payment failed');
    expect(embed.fields?.map((f) => [f.name, f.inline])).toEqual([
      ['Opened by', true],
      ['Opened', true],
      ['Status', true],
    ]);
  });
});
