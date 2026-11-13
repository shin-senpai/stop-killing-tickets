import { describe, expect, it } from 'vitest';
import { clientAuthorIdentity, hubAuthorIdentity, type HubAuthor } from './identity.js';

describe('clientAuthorIdentity', () => {
  const base = { displayName: 'Alice', avatarURL: 'a.png', serverLabel: 'acme', isStaff: false };

  it('adds the client label', () => {
    expect(clientAuthorIdentity(base)).toEqual({ username: 'Alice (acme)', avatarURL: 'a.png' });
  });

  it('labels client staff', () => {
    expect(clientAuthorIdentity({ ...base, isStaff: true }).username).toBe('Alice (acme Staff)');
  });

  it('sanitizes the name', () => {
    expect(clientAuthorIdentity({ ...base, serverLabel: 'Discord Fans' }).username).toBe(
      'Alice (Disc0rd Fans)',
    );
  });
});

describe('hubAuthorIdentity', () => {
  const bob: HubAuthor = {
    displayName: 'Bob',
    avatarURL: 'bob.png',
    topRoleName: 'Billing',
    hubIconURL: 'hub.png',
  };

  it('shows the staff name in named mode', () => {
    expect(hubAuthorIdentity('named', bob)).toEqual({
      username: 'Bob · Support',
      avatarURL: 'bob.png',
    });
  });

  it('hides the staff member in anonymous mode', () => {
    expect(hubAuthorIdentity('anonymous', bob)).toEqual({
      username: 'Support Team',
      avatarURL: 'hub.png',
    });
  });

  it('shows the top role in role mode', () => {
    expect(hubAuthorIdentity('role', bob).username).toBe('Support Team · Billing');
  });

  it('falls back to the team name when there is no role', () => {
    expect(hubAuthorIdentity('role', { ...bob, topRoleName: undefined }).username).toBe(
      'Support Team',
    );
  });
});
