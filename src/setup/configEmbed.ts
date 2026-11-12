import { EmbedBuilder } from 'discord.js';
import { Colors } from '../core/colors.js';
import type { ClientServer } from '../db/schema.js';
import { channelText, onOff, roleListText, statusLabel } from './format.js';

function limitsText(server: ClientServer): string {
  return [
    `Open tickets per user: **${server.maxOpenTickets}**`,
    `Minimum message length: **${server.minSubjectLength}**`,
    `People per ticket: **${server.maxParticipants}**`,
    `Participants can add people: **${onOff(server.participantsCanAdd)}**`,
    `Cooldown after closing: **${server.cooldownSeconds}s**`,
  ].join('\n');
}

export function buildClientConfigEmbed(server: ClientServer): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle('Ticket settings')
    .addFields(
      { name: 'Status', value: statusLabel(server.status), inline: true },
      { name: 'Ticket category', value: channelText(server.ticketCategoryId), inline: true },
      { name: 'Intake channel', value: channelText(server.intakeChannelId), inline: true },
      { name: 'Log channel', value: channelText(server.logChannelId), inline: true },
      { name: 'DM transcripts', value: onOff(server.dmTranscripts), inline: true },
      { name: 'Intake message', value: server.intakeText ? 'custom' : 'default', inline: true },
      { name: 'Staff roles', value: roleListText(server.staffRoleIds) },
      { name: 'Limits', value: limitsText(server) },
    );
}
