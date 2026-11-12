import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { config } from '../config.js';
import type { ClientServer, HubConfig } from '../db/schema.js';

export function isBotOwner(userId: string): boolean {
  return config.ownerIds.includes(userId);
}

export function isServerAdmin(member: GuildMember): boolean {
  return isBotOwner(member.id) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function isClientStaff(member: GuildMember, server: ClientServer): boolean {
  return isServerAdmin(member) || member.roles.cache.hasAny(...server.staffRoleIds);
}

/**
 * Hub staff are server admins and members with a hub staff role. If no hub
 * staff roles are set, anyone who can see the hub ticket channel counts as
 * staff, because category permissions already control who that is.
 */
export function isHubStaff(member: GuildMember, hub: HubConfig, ticketChannelId?: string): boolean {
  if (isServerAdmin(member)) return true;
  if (hub.staffRoleIds.length > 0) return member.roles.cache.hasAny(...hub.staffRoleIds);
  if (!ticketChannelId) return false;
  const channel = member.guild.channels.cache.get(ticketChannelId);
  return channel?.permissionsFor(member).has(PermissionFlagsBits.ViewChannel) ?? false;
}
