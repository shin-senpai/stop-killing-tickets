import type { GuildChannel, GuildMember, PermissionResolvable } from 'discord.js';
import { BOT_PERMISSIONS, missingBotPermissions } from '../core/permissions.js';

/** A line naming the permissions the bot lacks in a channel, or null if it has them all. */
export function missingPermissionLine(
  channel: GuildChannel,
  required: readonly PermissionResolvable[] = BOT_PERMISSIONS,
): string | null {
  const missing = missingBotPermissions(channel, required);
  if (missing.length === 0) return null;
  return `⚠️ In ${channel} I’m missing: ${missing.join(', ')}`;
}

export function missingGuildPermissionLine(member: GuildMember | null): string | null {
  if (!member) return null;
  const missing = member.permissions.missing([...BOT_PERMISSIONS]);
  if (missing.length === 0) return null;
  return `⚠️ My role is missing: ${missing.join(', ')}`;
}
