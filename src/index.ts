import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { createCommandSync } from './core/commandSync.js';
import { logger } from './core/logger.js';
import type { BotModule } from './core/module.js';
import { createInteractionRouter } from './core/router.js';
import { closeDatabase, runMigrations } from './db/index.js';
import { relayModule } from './relay/index.js';
import { setupModule } from './setup/index.js';
import { ticketsModule } from './tickets/index.js';

const modules: BotModule[] = [setupModule, ticketsModule, relayModule];

runMigrations();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  // Without these, edits and deletes of uncached messages (sent before a restart)
  // and leaves of uncached members are not emitted at all.
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  // Fallback for sends that do not set allowedMentions: never ping @everyone or roles.
  allowedMentions: { parse: ['users'] },
});

const route = createInteractionRouter(modules);
const commandSync = createCommandSync(modules);

client.on(Events.InteractionCreate, route);
client.on(Events.GuildCreate, (guild) => void commandSync.syncGuild(guild));
client.on(Events.Error, (error) => logger.error('Discord client error', error));
for (const module of modules) module.register?.(client);

client.once(Events.ClientReady, async (ready) => {
  logger.info(`Logged in as ${ready.user.tag} in ${ready.guilds.cache.size} servers`);
  if (!ready.guilds.cache.has(config.hubGuildId)) {
    logger.warn(`The bot is not in the hub server (${config.hubGuildId}). Invite it first.`);
  }
  await commandSync.syncAll(ready);
  for (const module of modules) {
    try {
      await module.onReady?.(ready);
    } catch (error) {
      logger.error(`Startup of module "${module.name}" failed`, error);
    }
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down`);
  try {
    await client.destroy();
  } catch (error) {
    logger.error('Failed to close the Discord connection', error);
  }
  closeDatabase();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));

await client.login(config.discordToken);
