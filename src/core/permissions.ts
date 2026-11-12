import {
  PermissionFlagsBits,
  PermissionsBitField,
  type GuildChannel,
  type PermissionResolvable,
} from 'discord.js';

/** Permissions the bot needs in every server. Used for the invite link and health checks. */
export const BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ManageChannels,
  // Required to edit channel permission overwrites.
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
] as const;

/** Permissions given to the opener and participants in a client ticket channel. */
export const TICKET_MEMBER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
] as const;

export const TICKET_STAFF_PERMISSIONS = [
  ...TICKET_MEMBER_PERMISSIONS,
  PermissionFlagsBits.ManageMessages,
] as const;

export function missingBotPermissions(
  channel: GuildChannel,
  required: readonly PermissionResolvable[] = BOT_PERMISSIONS,
): string[] {
  const me = channel.guild.members.me;
  if (!me) return ['(bot member not cached)'];
  const have = channel.permissionsFor(me);
  return new PermissionsBitField(required as PermissionResolvable[])
    .toArray()
    .filter((name) => !have.has(name));
}
