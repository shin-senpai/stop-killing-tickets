import type { Client } from 'discord.js';
import { getHubConfig } from '../db/queries.js';
import { fetchHubGuild } from './hub.js';
import { staffLabel, staffProfileOf } from './staffLabel.js';

export async function resolveStaffLabel(client: Client<true>, userId: string): Promise<string> {
  const hub = await fetchHubGuild(client).catch(() => null);
  const member = await hub?.members.fetch(userId).catch(() => null);
  return staffLabel(getHubConfig().staffIdentity, member ? staffProfileOf(member) : null);
}
