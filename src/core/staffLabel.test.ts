import { describe, expect, it } from 'vitest';
import { staffLabel } from './staffLabel.js';

const bob = { displayName: 'Bob', topRoleName: 'Billing' };

describe('staffLabel', () => {
  it('uses the display name in named mode', () => expect(staffLabel('named', bob)).toBe('Bob'));
  it('hides the name in anonymous mode', () =>
    expect(staffLabel('anonymous', bob)).toBe('Support Team'));
  it('adds the top role in role mode', () =>
    expect(staffLabel('role', bob)).toBe('Support Team (Billing)'));
  it('falls back without a role', () =>
    expect(staffLabel('role', { displayName: 'Bob', topRoleName: null })).toBe('Support Team'));
  it('falls back without a profile', () => expect(staffLabel('named', null)).toBe('Support Team'));
});
