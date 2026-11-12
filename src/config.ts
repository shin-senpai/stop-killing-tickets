const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function logLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.trim() ?? 'info';
  if (!(LOG_LEVELS as readonly string[]).includes(value)) {
    throw new Error(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
  }
  return value as LogLevel;
}

export const config = {
  discordToken: required('DISCORD_TOKEN'),
  hubGuildId: required('HUB_GUILD_ID'),
  ownerIds: (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  databasePath: process.env.DATABASE_PATH?.trim() || './data/bot.sqlite',
  logLevel: logLevel(),
};
