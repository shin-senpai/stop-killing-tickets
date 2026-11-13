import type { GuildChannel, GuildMember, PermissionResolvable } from 'discord.js';
import {
  BOT_SERVER_PERMISSIONS,
  missingBotPermissions,
  missingPermissionNames,
  TICKET_CATEGORY_PERMISSIONS,
} from '../core/permissions.js';

/** A line naming the permissions the bot lacks in a channel, or null if it has them all. */
export function missingPermissionLine(
  channel: GuildChannel,
  required: readonly PermissionResolvable[] = TICKET_CATEGORY_PERMISSIONS,
): string | null {
  const missing = missingBotPermissions(channel, required);
  if (missing.length === 0) return null;
  return `⚠️ In ${channel} I’m missing: ${missing.join(', ')}`;
}

export function missingServerPermissionLine(member: GuildMember | null): string | null {
  if (!member) return null;
  const missing = missingPermissionNames(member.permissions, BOT_SERVER_PERMISSIONS);
  if (missing.length === 0) return null;
  return `⚠️ My role is missing: ${missing.join(', ')}`;
}
