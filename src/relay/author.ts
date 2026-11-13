import type { GuildMember, Message } from 'discord.js';
import { isClientStaff } from '../core/staff.js';
import { getClientServer, getHubConfig } from '../db/queries.js';
import type { Ticket, TicketSide } from '../db/schema.js';
import { clientAuthorIdentity, hubAuthorIdentity, type WebhookIdentity } from './identity.js';

export interface RelayAuthor {
  identity: WebhookIdentity;
  isStaff: boolean;
}

export async function resolveRelayAuthor(
  message: Message<true>,
  side: TicketSide,
  ticket: Ticket,
): Promise<RelayAuthor> {
  const member =
    message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const displayName = member?.displayName ?? message.author.displayName;
  const avatarURL = (member ?? message.author).displayAvatarURL();

  if (side === 'client') {
    const server = getClientServer(ticket.clientGuildId);
    const isStaff = member !== null && server !== undefined && isClientStaff(member, server);
    return {
      isStaff,
      identity: clientAuthorIdentity({
        displayName,
        avatarURL,
        serverLabel: server?.tag ?? message.guild.name,
        isStaff,
      }),
    };
  }

  return {
    isStaff: true,
    identity: hubAuthorIdentity(getHubConfig().staffIdentity, {
      displayName,
      avatarURL,
      topRoleName: topRoleName(member),
      hubIconURL: message.guild.iconURL() ?? undefined,
    }),
  };
}

function topRoleName(member: GuildMember | null): string | undefined {
  if (!member) return undefined;
  const role = member.roles.highest;
  return role.id === member.guild.id ? undefined : role.name;
}
