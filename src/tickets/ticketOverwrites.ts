import {
  OverwriteType,
  PermissionFlagsBits,
  type OverwriteData,
  type PermissionsBitField,
} from 'discord.js';
import {
  grantablePermissions,
  TICKET_MEMBER_PERMISSIONS,
  TICKET_STAFF_PERMISSIONS,
} from '../core/permissions.js';

/** What the bot grants itself in each client ticket channel, so the @everyone deny cannot lock it out. */
export const BOT_TICKET_PERMISSIONS = [
  ...TICKET_STAFF_PERMISSIONS,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
] as const;

interface ClientTicketOverwriteInput {
  guildId: string;
  botId: string;
  /** The bot's server-wide permissions. Discord rejects overwrites that grant more. */
  botPermissions: Readonly<PermissionsBitField>;
  openerId: string;
  staffRoleIds: readonly string[];
}

export function clientTicketOverwrites(input: ClientTicketOverwriteInput): OverwriteData[] {
  const grantable = (wanted: readonly bigint[]) =>
    grantablePermissions(input.botPermissions, wanted);
  return [
    { id: input.guildId, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: input.botId, type: OverwriteType.Member, allow: grantable(BOT_TICKET_PERMISSIONS) },
    { id: input.openerId, type: OverwriteType.Member, allow: grantable(TICKET_MEMBER_PERMISSIONS) },
    ...input.staffRoleIds.map((id) => staffRoleOverwrite(id, input.botPermissions)),
  ];
}

export function staffRoleOverwrite(
  roleId: string,
  botPermissions: Readonly<PermissionsBitField>,
): OverwriteData {
  return {
    id: roleId,
    type: OverwriteType.Role,
    allow: grantablePermissions(botPermissions, TICKET_STAFF_PERMISSIONS),
  };
}
