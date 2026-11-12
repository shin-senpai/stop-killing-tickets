import type { GuildMember } from 'discord.js';
import type { HubConfig } from '../db/schema.js';

export interface StaffProfile {
  displayName: string;
  /** Null when the member has no role above @everyone. */
  topRoleName: string | null;
}

export const SUPPORT_TEAM = 'Support Team';

export function staffProfileOf(member: GuildMember): StaffProfile {
  const top = member.roles.highest;
  return {
    displayName: member.displayName,
    topRoleName: top.id === member.guild.id ? null : top.name,
  };
}

/**
 * How a hub staff member is named to users in client servers. Relayed
 * messages use the same modes for the webhook username (see relay/identity.ts).
 */
export function staffLabel(
  identity: HubConfig['staffIdentity'],
  profile: StaffProfile | null,
): string {
  if (!profile || identity === 'anonymous') return SUPPORT_TEAM;
  if (identity === 'role') {
    return profile.topRoleName ? `${SUPPORT_TEAM} (${profile.topRoleName})` : SUPPORT_TEAM;
  }
  return profile.displayName;
}
