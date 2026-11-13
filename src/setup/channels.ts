import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
} from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import {
  botGuildPermissions,
  grantablePermissions,
  INTAKE_CHANNEL_PERMISSIONS,
  LOG_CHANNEL_PERMISSIONS,
  missingBotPermissions,
  permissionNames,
  TICKET_CATEGORY_PERMISSIONS,
} from '../core/permissions.js';

export { INTAKE_CHANNEL_PERMISSIONS, LOG_CHANNEL_PERMISSIONS };

interface CreatedChannel {
  /** What the admin sees in the message, for example "ticket category". */
  description: string;
  /** The command option that takes an existing channel instead. */
  option: string;
  /** What the bot needs on the channel the admin creates. */
  permissions: readonly bigint[];
}

/** Creating a category or a channel outside a category needs Manage Channels on the whole server. */
function requireServerWideManageChannels(guild: Guild, created: CreatedChannel): void {
  if (botGuildPermissions(guild).has(PermissionFlagsBits.ManageChannels)) return;
  throw new UserFacingError(
    [
      `I can’t create the ${created.description}, because my role does not have Manage Channels.`,
      `Create it yourself, then run the command again and choose it in the \`${created.option}\` option.`,
      `Give me these permissions on it: ${permissionNames(created.permissions).join(', ')}.`,
    ].join('\n'),
  );
}

function botId(guild: Guild): string {
  return guild.client.user.id;
}

function hiddenFromEveryone(guild: Guild, botAllow: readonly bigint[]): OverwriteResolvable[] {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: botId(guild), allow: grantablePermissions(botGuildPermissions(guild), botAllow) },
  ];
}

export function createTicketCategory(guild: Guild): Promise<CategoryChannel> {
  requireServerWideManageChannels(guild, {
    description: 'ticket category',
    option: 'category',
    permissions: TICKET_CATEGORY_PERMISSIONS,
  });
  return guild.channels.create({
    name: 'Tickets',
    type: ChannelType.GuildCategory,
    permissionOverwrites: hiddenFromEveryone(guild, TICKET_CATEGORY_PERMISSIONS),
    reason: 'Ticket setup',
  });
}

/** The bot must already have its permissions on the category: it cannot grant them to itself. */
export async function lockTicketCategory(category: CategoryChannel): Promise<void> {
  const missing = missingBotPermissions(category, TICKET_CATEGORY_PERMISSIONS);
  if (missing.length > 0) {
    throw new UserFacingError(
      `I’m missing these permissions on ${category}: ${missing.join(', ')}. Give them to me on the category and try again.`,
    );
  }
  const guild = category.guild;
  await category.permissionOverwrites.edit(
    botId(guild),
    Object.fromEntries(
      permissionNames(
        grantablePermissions(botGuildPermissions(guild), TICKET_CATEGORY_PERMISSIONS),
      ).map((name) => [name, true]),
    ),
    { reason: 'Ticket setup' },
  );
  // A role permission does not survive an @everyone deny on the category, so the bot's own overwrite comes first.
  await category.permissionOverwrites.edit(
    guild.roles.everyone,
    { ViewChannel: false },
    { reason: 'Ticket setup' },
  );
}

export function createIntakeChannel(guild: Guild): Promise<TextChannel> {
  requireServerWideManageChannels(guild, {
    description: 'intake channel',
    option: 'intake-channel',
    permissions: INTAKE_CHANNEL_PERMISSIONS,
  });
  return guild.channels.create({
    name: 'open-a-ticket',
    type: ChannelType.GuildText,
    topic: 'Type your question here to open a private ticket.',
    permissionOverwrites: [
      {
        id: botId(guild),
        allow: grantablePermissions(botGuildPermissions(guild), INTAKE_CHANNEL_PERMISSIONS),
      },
    ],
    reason: 'Ticket setup',
  });
}

export function createStaffTextChannel(
  guild: Guild,
  name: string,
  option: string,
): Promise<TextChannel> {
  requireServerWideManageChannels(guild, {
    description: `#${name} channel`,
    option,
    permissions: LOG_CHANNEL_PERMISSIONS,
  });
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    permissionOverwrites: hiddenFromEveryone(guild, LOG_CHANNEL_PERMISSIONS),
    reason: 'Ticket bot setup',
  });
}

export function createStaffCategory(
  guild: Guild,
  name: string,
  option: string,
): Promise<CategoryChannel> {
  requireServerWideManageChannels(guild, {
    description: `${name} category`,
    option,
    permissions: TICKET_CATEGORY_PERMISSIONS,
  });
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: hiddenFromEveryone(guild, TICKET_CATEGORY_PERMISSIONS),
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
