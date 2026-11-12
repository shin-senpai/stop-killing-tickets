import {
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
} from 'discord.js';

export const INTAKE_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
] as const;

export const LOG_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
] as const;

// Manage Roles is left out on purpose: Discord rejects an overwrite that grants
// Manage Permissions unless the bot is an Administrator or already has it from
// an overwrite. The bot's server-wide Manage Roles is enough to edit overwrites.
const TICKET_CATEGORY_BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
] as const;

function botId(guild: Guild): string {
  return guild.client.user.id;
}

function hiddenFromEveryone(guild: Guild, botAllow: readonly bigint[]): OverwriteResolvable[] {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: botId(guild), allow: [...botAllow] },
  ];
}

export function createTicketCategory(guild: Guild): Promise<CategoryChannel> {
  return guild.channels.create({
    name: 'Tickets',
    type: ChannelType.GuildCategory,
    permissionOverwrites: hiddenFromEveryone(guild, TICKET_CATEGORY_BOT_PERMISSIONS),
    reason: 'Ticket setup',
  });
}

export async function lockTicketCategory(category: CategoryChannel): Promise<void> {
  const { guild } = category;
  await category.permissionOverwrites.edit(
    guild.roles.everyone,
    { ViewChannel: false },
    { reason: 'Ticket setup' },
  );
  const allow = Object.fromEntries(
    new PermissionsBitField([...TICKET_CATEGORY_BOT_PERMISSIONS])
      .toArray()
      .map((name) => [name, true]),
  );
  await category.permissionOverwrites.edit(botId(guild), allow, { reason: 'Ticket setup' });
}

export function createIntakeChannel(guild: Guild): Promise<TextChannel> {
  return guild.channels.create({
    name: 'open-a-ticket',
    type: ChannelType.GuildText,
    topic: 'Type your question here to open a private ticket.',
    permissionOverwrites: [{ id: botId(guild), allow: [...INTAKE_CHANNEL_PERMISSIONS] }],
    reason: 'Ticket setup',
  });
}

export function createStaffTextChannel(guild: Guild, name: string): Promise<TextChannel> {
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    permissionOverwrites: hiddenFromEveryone(guild, LOG_CHANNEL_PERMISSIONS),
    reason: 'Ticket bot setup',
  });
}

export function createStaffCategory(guild: Guild, name: string): Promise<CategoryChannel> {
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: hiddenFromEveryone(guild, TICKET_CATEGORY_BOT_PERMISSIONS),
    reason: 'Ticket bot setup',
  });
}

export function findCategory(guild: Guild, id: string | null): CategoryChannel | undefined {
  if (!id) return undefined;
  const channel = guild.channels.cache.get(id);
  return channel?.type === ChannelType.GuildCategory ? channel : undefined;
}

export function findTextChannel(guild: Guild, id: string | null): TextChannel | undefined {
  if (!id) return undefined;
  const channel = guild.channels.cache.get(id);
  return channel?.type === ChannelType.GuildText ? channel : undefined;
}

export function childChannelCount(category: CategoryChannel): number {
  return category.children.cache.size;
}
