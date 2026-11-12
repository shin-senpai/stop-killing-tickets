import { describe, expect, it } from 'vitest';
import {
  clientChannelName,
  hubChannelName,
  hubChannelTopic,
  overflowCategoryName,
  renamedChannelNames,
} from './names.js';

describe('channel names', () => {
  it('names the client channel after the number and opener', () => {
    expect(clientChannelName(42, 'Jöhn Doe')).toBe('ticket-0042-john-doe');
  });

  it('names the hub channel after the tag and number', () => {
    expect(hubChannelName('acme', 7)).toBe('acme-0007');
  });

  it('keeps the number prefix on rename', () => {
    expect(renamedChannelNames('acme', 42, 'Refund Issue!')).toEqual({
      client: 'ticket-0042-refund-issue',
      hub: 'acme-0042-refund-issue',
    });
  });
});

describe('overflowCategoryName', () => {
  it('adds the index', () => expect(overflowCategoryName('Tickets', 2)).toBe('Tickets 2'));

  it('stays within 100 characters', () => {
    const name = overflowCategoryName('x'.repeat(100), 12);
    expect(name).toHaveLength(100);
    expect(name.endsWith(' 12')).toBe(true);
  });
});

describe('hubChannelTopic', () => {
  it('puts the subject on one line', () => {
    expect(hubChannelTopic('Acme', 'bob', '1', 'My payment\n\nfailed')).toBe(
      'Acme · @bob (1) · My payment failed',
    );
  });

  it('stays within the topic limit', () => {
    expect(hubChannelTopic('Acme', 'bob', '1', 'x'.repeat(2000))).toHaveLength(1024);
  });
});
