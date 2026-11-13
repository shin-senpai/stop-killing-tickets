import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { describe, expect, it } from 'vitest';
import {
  grantablePermissions,
  INTAKE_CHANNEL_PERMISSIONS,
  missingPermissionNames,
  permissionNames,
} from './permissions.js';

describe('missingPermissionNames', () => {
  it('lists the required permissions that are not held', () => {
    const held = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    expect(
      missingPermissionNames(held, [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ManageMessages,
      ]),
    ).toEqual(['ManageMessages']);
  });

  it('returns nothing when everything is held', () => {
    const held = new PermissionsBitField(INTAKE_CHANNEL_PERMISSIONS);
    expect(missingPermissionNames(held, INTAKE_CHANNEL_PERMISSIONS)).toEqual([]);
  });
});

describe('grantablePermissions', () => {
  it('leaves out Manage Permissions unless the bot is an administrator', () => {
    const held = new PermissionsBitField([PermissionFlagsBits.ManageRoles]);
    expect(grantablePermissions(held, [PermissionFlagsBits.ManageRoles])).toEqual([]);
    const admin = new PermissionsBitField([PermissionFlagsBits.Administrator]);
    expect(grantablePermissions(admin, [PermissionFlagsBits.ManageRoles])).toEqual([
      PermissionFlagsBits.ManageRoles,
    ]);
  });

  it('keeps only the permissions the bot has', () => {
    const held = new PermissionsBitField([PermissionFlagsBits.ViewChannel]);
    expect(
      grantablePermissions(held, [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ManageRoles,
      ]),
    ).toEqual([PermissionFlagsBits.ViewChannel]);
  });
});

describe('permissionNames', () => {
  it('returns the names of the permissions', () => {
    expect(permissionNames([PermissionFlagsBits.ManageRoles])).toEqual(['ManageRoles']);
  });
});
