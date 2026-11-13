import {
  PermissionFlagsBits,
  PermissionsBitField,
  type Guild,
  type GuildChannel,
  type PermissionResolvable,
} from 'discord.js';

/**
 * The bot's role needs these server-wide. Discord only lets a bot set overwrites
 * on a new channel for permissions it has in the server, not in the category,
 * and only administrators may put Manage Permissions in a channel overwrite.
 * Nothing beyond this set is checked or asked for.
 */
export const BOT_SERVER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ManageChannels,
  // Shown as Manage Permissions on channels: needed to edit ticket channel overwrites.
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
  // Discord split pinning out of Manage Messages into its own permission.
  PermissionFlagsBits.PinMessages,
  PermissionFlagsBits.AddReactions,
] as const;

export const INVITE_PERMISSIONS = new PermissionsBitField([...BOT_SERVER_PERMISSIONS]).bitfield;

/** Needed on a ticket category in a client server and in the hub. A category can deny what the role allows. */
export const TICKET_CATEGORY_PERMISSIONS = BOT_SERVER_PERMISSIONS;

export const INTAKE_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.PinMessages,
  PermissionFlagsBits.AddReactions,
] as const;

/** Needed on the log channels and on the hub transcript channel. */
export const LOG_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
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
  PermissionFlagsBits.PinMessages,
] as const;

/** Names of the permissions in `required` that are not in `held`. */
export function missingPermissionNames(
  held: Readonly<PermissionsBitField>,
  required: readonly PermissionResolvable[],
): string[] {
  return new PermissionsBitField(required as PermissionResolvable[])
    .toArray()
    .filter((name) => !held.has(name));
}

/**
 * The part of `wanted` the bot may put in an overwrite: Discord rejects anything
 * the bot lacks server-wide, and Manage Permissions unless the bot is an administrator.
 */
export function grantablePermissions(
  held: Readonly<PermissionsBitField>,
  wanted: readonly bigint[],
): bigint[] {
  const isAdmin = held.has(PermissionFlagsBits.Administrator);
  return wanted.filter(
    (permission) =>
      held.has(permission) && (isAdmin || permission !== PermissionFlagsBits.ManageRoles),
  );
}

export function missingBotPermissions(
  channel: GuildChannel,
  required: readonly PermissionResolvable[],
): string[] {
  const me = channel.guild.members.me;
  if (!me) return ['(bot member not cached)'];
  return missingPermissionNames(channel.permissionsFor(me), required);
}

export function botGuildPermissions(guild: Guild): Readonly<PermissionsBitField> {
  return guild.members.me?.permissions ?? new PermissionsBitField();
}

export function permissionNames(permissions: readonly bigint[]): string[] {
  return new PermissionsBitField([...permissions]).toArray();
}
