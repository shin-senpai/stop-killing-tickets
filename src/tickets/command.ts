import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { UserFacingError } from '../core/errors.js';
import type { SlashCommand } from '../core/module.js';
import {
  requireCanCloseOrReopen,
  requireReopenWithinLimit,
  requireOpen,
  requireSide,
  requireStaff,
  ticketInChannel,
  type TicketScope,
} from './access.js';
import { fetchTicketChannel } from '../relay/channels.js';
import { claimTicket, transferTicket, unclaimTicket } from './claim.js';
import { buildTicketInfo } from './info.js';
import { closeTicket, reopenTicket } from './lifecycle.js';
import { renamedChannelNames } from './names.js';
import {
  addParticipants,
  describeChange,
  personOf,
  removeParticipants,
  requireCanManageParticipants,
} from './participants.js';

type Interaction = ChatInputCommandInteraction<'cached'>;
type SubcommandHandler = (interaction: Interaction, scope: TicketScope) => Promise<void>;

const REASON_LIMIT = 500;
const NOTE_LIMIT = 4000;
const NAME_LIMIT = 40;

const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Manage this ticket')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add someone to this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Who to add').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove someone from this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Who to remove').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('Close this ticket')
      .addStringOption((o) =>
        o.setName('reason').setDescription('Why it is closed').setMaxLength(REASON_LIMIT),
      ),
  )
  .addSubcommand((sub) => sub.setName('reopen').setDescription('Reopen this ticket'))
  .addSubcommand((sub) => sub.setName('info').setDescription('Show details about this ticket'))
  .addSubcommand((sub) => sub.setName('claim').setDescription('Take this ticket'))
  .addSubcommand((sub) => sub.setName('unclaim').setDescription('Let go of this ticket'))
  .addSubcommand((sub) =>
    sub
      .setName('transfer')
      .setDescription('Give this ticket to another staff member')
      .addUserOption((o) =>
        o.setName('staff').setDescription('Who gets the ticket').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('note')
      .setDescription('Post a note that only staff can see')
      .addStringOption((o) =>
        o.setName('text').setDescription('The note').setRequired(true).setMaxLength(NOTE_LIMIT),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('rename')
      .setDescription('Rename both ticket channels')
      .addStringOption((o) =>
        o.setName('name').setDescription('The new name').setRequired(true).setMaxLength(NAME_LIMIT),
      ),
  )
  .toJSON();

const handlers: Record<string, SubcommandHandler> = {
  async add(interaction, scope) {
    requireCanManageParticipants(interaction.member, scope);
    const user = interaction.options.getUser('user', true);
    const member = interaction.options.getMember('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const change = await addParticipants(interaction.client, scope, interaction.member, [
      { user, member },
    ]);
    await interaction.editReply(describeChange('Added', change));
  },

  async remove(interaction, scope) {
    requireCanManageParticipants(interaction.member, scope);
    const user = interaction.options.getUser('user', true);
    const person = personOf(user, interaction.options.getMember('user'));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const change = await removeParticipants(interaction.client, scope, interaction.member, [
      person,
    ]);
    await interaction.editReply(describeChange('Removed', change));
  },

  async close(interaction, scope) {
    requireCanCloseOrReopen(interaction.member, scope);
    requireOpen(scope.ticket);
    const reason = interaction.options.getString('reason');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await closeTicket(interaction.client, scope.ticket, interaction.user, reason);
    await interaction.editReply('The ticket is closed.');
  },

  async reopen(interaction, scope) {
    requireCanCloseOrReopen(interaction.member, scope);
    if (scope.ticket.status === 'open') throw new UserFacingError('This ticket is already open.');
    if (scope.ticket.status === 'closed') {
      throw new UserFacingError('This ticket can no longer be reopened. Please open a new one.');
    }
    requireReopenWithinLimit(interaction.member, scope);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await reopenTicket(interaction.client, scope.ticket, interaction.user);
    await interaction.editReply('The ticket is open again.');
  },

  async info(interaction, scope) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({
      embeds: [await buildTicketInfo(interaction.client, scope)],
      allowedMentions: { parse: [] },
    });
  },

  async claim(interaction, scope) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await claimTicket(interaction.client, scope, interaction.member);
    await interaction.editReply('You claimed this ticket.');
  },

  async unclaim(interaction, scope) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await unclaimTicket(interaction.client, scope, interaction.member);
    await interaction.editReply('You let go of this ticket.');
  },

  async transfer(interaction, scope) {
    const target = interaction.options.getMember('staff');
    if (!target) throw new UserFacingError('That person is not in this server.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await transferTicket(interaction.client, scope, interaction.member, target);
    await interaction.editReply(`You gave this ticket to ${target.displayName}.`);
  },

  async note(interaction, scope) {
    requireSide(scope, 'hub');
    requireStaff(interaction.member, scope);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await fetchTicketChannel(interaction.client, scope.ticket.hubChannelId);
    if (!channel) throw new UserFacingError('The ticket channel is gone.');
    const note = new EmbedBuilder()
      .setColor(Colors.note)
      .setAuthor({
        name: interaction.member.displayName,
        iconURL: interaction.member.displayAvatarURL(),
      })
      .setTitle('🔒 Internal note')
      .setDescription(interaction.options.getString('text', true))
      .setFooter({ text: 'Only staff can see this.' });
    await channel.send({ embeds: [note], allowedMentions: { parse: [] } });
    await interaction.editReply('Note added.');
  },

  async rename(interaction, scope) {
    requireStaff(interaction.member, scope);
    requireOpen(scope.ticket);
    const names = renamedChannelNames(
      scope.server.tag ?? 'ticket',
      scope.ticket.number,
      interaction.options.getString('name', true),
    );
    // Discord allows two renames per channel every ten minutes, and discord.js waits out the limit.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [clientChannel, hubChannel] = await Promise.all([
      fetchTicketChannel(interaction.client, scope.ticket.clientChannelId),
      fetchTicketChannel(interaction.client, scope.ticket.hubChannelId),
    ]);
    await Promise.all([clientChannel?.setName(names.client), hubChannel?.setName(names.hub)]);
    await interaction.editReply('Renamed the ticket.');
  },
};

export const ticketCommand: SlashCommand = {
  scope: 'both',
  data,
  async execute(interaction) {
    const scope = ticketInChannel(interaction.channelId);
    const handler = handlers[interaction.options.getSubcommand()];
    if (!handler) throw new UserFacingError('Unknown subcommand.');
    await handler(interaction, scope);
  },
};
