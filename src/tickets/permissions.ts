import {
  OverwriteType,
  PermissionFlagsBits,
  PermissionsBitField,
  type Client,
  type Guild,
  type OverwriteData,
  type OverwriteResolvable,
  type PermissionOverwriteOptions,
  type TextChannel,
} from 'discord.js';
import { logger } from '../core/logger.js';
import { TICKET_MEMBER_PERMISSIONS, TICKET_STAFF_PERMISSIONS } from '../core/permissions.js';
import { getParticipantIds } from '../db/queries.js';
import type { ClientServer, Ticket } from '../db/schema.js';
import { fetchTicketChannel } from '../relay/channels.js';
import { getActiveTicketsOfClient } from './repo.js';

/** What the bot grants itself in each client ticket channel. */
export const BOT_TICKET_PERMISSIONS = [
  ...TICKET_STAFF_PERMISSIONS,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
] as const;

interface ClientTicketOverwriteInput {
  guildId: string;
  botId: string;
  openerId: string;
  staffRoleIds: readonly string[];
}

export function clientTicketOverwrites(input: ClientTicketOverwriteInput): OverwriteData[] {
  return [
    { id: input.guildId, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: input.botId, type: OverwriteType.Member, allow: BOT_TICKET_PERMISSIONS },
    { id: input.openerId, type: OverwriteType.Member, allow: TICKET_MEMBER_PERMISSIONS },
    ...input.staffRoleIds.map((id) => staffRoleOverwrite(id)),
  ];
}

/** Overwrites for roles that were deleted from the server would make Discord reject the request. */
export function existingRoleIds(guild: Guild, roleIds: readonly string[]): string[] {
  return roleIds.filter((id) => guild.roles.cache.has(id));
}

export function grantTicketAccess(channel: TextChannel, userId: string): Promise<unknown> {
  return channel.permissionOverwrites.create(
    userId,
    permissionOptions(TICKET_MEMBER_PERMISSIONS, true),
    { type: OverwriteType.Member },
  );
}

export function revokeTicketAccess(channel: TextChannel, userId: string): Promise<unknown> {
  return channel.permissionOverwrites.delete(userId);
}

export async function syncStaffRoleOverwrites(
  client: Client<true>,
  server: ClientServer,
): Promise<void> {
  const guild = client.guilds.cache.get(server.guildId);
  if (!guild) return;
  const roleIds = existingRoleIds(guild, server.staffRoleIds);
  for (const ticket of getActiveTicketsOfClient(server.guildId)) {
    const channel = await fetchTicketChannel(client, ticket.clientChannelId);
    if (!channel) continue;
    try {
      await channel.permissionOverwrites.set(withStaffRoles(channel, roleIds));
    } catch (error) {
      logger.warn(`Failed to update staff roles in ticket channel ${channel.id}`, error);
    }
  }
}

export async function setTicketMembersCanSend(
  client: Client<true>,
  ticket: Ticket,
  canSend: boolean,
): Promise<void> {
  const channel = await fetchTicketChannel(client, ticket.clientChannelId);
  if (!channel) return;
  const userIds = [ticket.openerId, ...getParticipantIds(ticket.id)];
  await Promise.all(
    userIds.map((userId) =>
      channel.permissionOverwrites
        .edit(userId, { SendMessages: canSend }, { type: OverwriteType.Member })
        .catch((error: unknown) =>
          logger.warn(`Failed to set send permission for ${userId} in ${channel.id}`, error),
        ),
    ),
  );
}

/** Keeps @everyone and member overwrites, and replaces all role overwrites with the staff roles. */
function withStaffRoles(channel: TextChannel, staffRoleIds: string[]): OverwriteResolvable[] {
  const kept = channel.permissionOverwrites.cache.filter(
    (overwrite) => overwrite.type === OverwriteType.Member || overwrite.id === channel.guild.id,
  );
  return [...kept.values(), ...staffRoleIds.map((id) => staffRoleOverwrite(id))];
}

function staffRoleOverwrite(roleId: string): OverwriteData {
  return { id: roleId, type: OverwriteType.Role, allow: TICKET_STAFF_PERMISSIONS };
}

function permissionOptions(
  permissions: readonly bigint[],
  value: boolean,
): PermissionOverwriteOptions {
  const names = new PermissionsBitField([...permissions]).toArray();
  return Object.fromEntries(names.map((name) => [name, value]));
}
