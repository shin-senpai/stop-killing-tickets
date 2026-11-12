import { EmbedBuilder, TimestampStyles, time, userMention, type Client } from 'discord.js';
import { Colors } from '../core/colors.js';
import { padTicketNumber, truncate } from '../core/text.js';
import { getParticipantIds } from '../db/queries.js';
import type { TicketScope } from './access.js';
import { hubChannelName } from './names.js';
import { resolveStaffLabel } from '../core/staffIdentity.js';
import { clientStatus, hubStatus } from './starterView.js';

/** Client-side viewers see the claim as the staff identity mode allows. */
export async function buildTicketInfo(
  client: Client<true>,
  { ticket, side, server }: TicketScope,
): Promise<EmbedBuilder> {
  const helperLabel = ticket.claimedBy ? await resolveStaffLabel(client, ticket.claimedBy) : null;
  const participants = getParticipantIds(ticket.id);
  const title =
    side === 'hub'
      ? hubChannelName(server.tag ?? 'ticket', ticket.number)
      : `Ticket #${padTicketNumber(ticket.number)}`;
  const embed = new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle(title)
    .addFields(
      { name: 'Subject', value: truncate(ticket.subject.trim() || '(no text)', 1024) },
      { name: 'Opened by', value: userMention(ticket.openerId), inline: true },
      {
        name: 'Opened',
        value: time(ticket.createdAt, TimestampStyles.RelativeTime),
        inline: true,
      },
      {
        name: 'Status',
        value: side === 'hub' ? hubStatus(ticket) : clientStatus(ticket, helperLabel),
      },
      {
        name: 'Participants',
        value: participants.length > 0 ? participants.map(userMention).join(', ') : 'None',
      },
    );
  if (side === 'hub') {
    const guild = client.guilds.cache.get(ticket.clientGuildId);
    embed.addFields({
      name: 'Server',
      value: `${guild?.name ?? server.name ?? 'Unknown'} (\`${ticket.clientGuildId}\`)`,
    });
  }
  return embed;
}
