import { OverwriteType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { clientTicketOverwrites } from './ticketOverwrites.js';

const input = {
  guildId: 'guild',
  botId: 'bot',
  openerId: 'opener',
  staffRoleIds: ['staff'],
};

describe('clientTicketOverwrites', () => {
  it('grants the bot only what it holds in the category', () => {
    const botPermissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ManageChannels,
    ]);
    const overwrites = clientTicketOverwrites({ ...input, botPermissions });
    const bot = overwrites.find((overwrite) => overwrite.id === 'bot');
    expect(bot?.type).toBe(OverwriteType.Member);
    expect(new PermissionsBitField(bot?.allow).toArray().sort()).toEqual([
      'ManageChannels',
      'ViewChannel',
    ]);
  });

  it('never grants itself Manage Permissions', () => {
    const botPermissions = new PermissionsBitField(PermissionFlagsBits.ManageRoles);
    const bot = clientTicketOverwrites({ ...input, botPermissions }).find((o) => o.id === 'bot');
    expect(new PermissionsBitField(bot?.allow).has(PermissionFlagsBits.ManageRoles)).toBe(false);
  });

  it('hides the channel from everyone', () => {
    const [everyone] = clientTicketOverwrites({
      ...input,
      botPermissions: new PermissionsBitField(),
    });
    expect(everyone?.id).toBe('guild');
    expect(new PermissionsBitField(everyone?.deny).has(PermissionFlagsBits.ViewChannel)).toBe(true);
  });
});
