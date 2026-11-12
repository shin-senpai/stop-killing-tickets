import type { Client, Guild } from 'discord.js';
import { isHubGuild } from './hub.js';
import { logger } from './logger.js';
import type { BotModule } from './module.js';

// Per-guild registration lets the hub and client servers have different command
// sets, and unlike global commands, changes apply at once.
export function createCommandSync(modules: BotModule[]) {
  const all = modules.flatMap((module) => module.commands ?? []);

  async function syncGuild(guild: Guild): Promise<void> {
    const scope = isHubGuild(guild.id) ? 'hub' : 'client';
    const body = all.filter((c) => c.scope === scope || c.scope === 'both').map((c) => c.data);
    try {
      await guild.commands.set(body);
      logger.debug(`Registered ${body.length} commands in ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error(`Failed to register commands in ${guild.name} (${guild.id})`, error);
    }
  }

  async function syncAll(client: Client<true>): Promise<void> {
    await Promise.all(client.guilds.cache.map(syncGuild));
  }

  return { syncGuild, syncAll };
}
