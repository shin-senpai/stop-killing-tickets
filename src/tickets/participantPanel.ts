import {
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type Client,
  type InteractionEditReplyOptions,
} from 'discord.js';
import { customId } from '../core/customId.js';
import type { ComponentHandler } from '../core/module.js';
import { truncate } from '../core/text.js';
import { getParticipantIds } from '../db/queries.js';
import { ticketFromComponent, type TicketScope } from './access.js';
import { TicketComponentIds } from './ids.js';
import {
  addParticipants,
  describeChange,
  removeParticipants,
  requireCanManageParticipants,
  resolvePerson,
} from './participants.js';
import { remainingParticipantSlots } from './rules.js';

const USER_SELECT_LIMIT = 10;
const SELECT_OPTION_LIMIT = 25;
const OPTION_LABEL_LIMIT = 100;

const addPeopleButton: ComponentHandler = {
  id: TicketComponentIds.addPeople,
  async handle(interaction, [ticketId]) {
    if (!interaction.isButton()) return;
    const scope = ticketFromComponent(ticketId, interaction.channelId);
    requireCanManageParticipants(interaction.member, scope);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(await participantPanel(interaction.client, scope));
  },
};

const addPeopleSelect: ComponentHandler = {
  id: TicketComponentIds.addPeopleSelect,
  async handle(interaction, [ticketId]) {
    if (!interaction.isUserSelectMenu()) return;
    const scope = ticketFromComponent(ticketId, interaction.channelId);
    requireCanManageParticipants(interaction.member, scope);
    await interaction.deferUpdate();
    const candidates = interaction.users.map((user) => ({
      user,
      member: interaction.members.get(user.id) ?? null,
    }));
    const change = await addParticipants(interaction.client, scope, interaction.member, candidates);
    await interaction.editReply({ content: describeChange('Added', change), components: [] });
  },
};

const removePeopleSelect: ComponentHandler = {
  id: TicketComponentIds.removePeopleSelect,
  async handle(interaction, [ticketId]) {
    if (!interaction.isStringSelectMenu()) return;
    const scope = ticketFromComponent(ticketId, interaction.channelId);
    requireCanManageParticipants(interaction.member, scope);
    await interaction.deferUpdate();
    const people = await Promise.all(
      interaction.values.map((id) => resolvePerson(interaction.client, interaction.guildId, id)),
    );
    const change = await removeParticipants(interaction.client, scope, interaction.member, people);
    await interaction.editReply({ content: describeChange('Removed', change), components: [] });
  },
};

export const participantComponents = [addPeopleButton, addPeopleSelect, removePeopleSelect];

async function participantPanel(
  client: Client<true>,
  { ticket, server }: TicketScope,
): Promise<Pick<InteractionEditReplyOptions, 'content' | 'components'>> {
  const participantIds = getParticipantIds(ticket.id);
  const slots = remainingParticipantSlots(server.maxParticipants, participantIds.length);
  const rows: ActionRowBuilder<UserSelectMenuBuilder | StringSelectMenuBuilder>[] = [];
  const lines: string[] = [];

  if (slots > 0) {
    lines.push(`Pick people to add. ${slots} more can join.`);
    rows.push(
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(customId(TicketComponentIds.addPeopleSelect, ticket.id))
          .setPlaceholder('Add people')
          .setMaxValues(Math.min(slots, USER_SELECT_LIMIT)),
      ),
    );
  } else {
    lines.push(`This ticket is full (${server.maxParticipants} people).`);
  }

  if (participantIds.length > 0) {
    lines.push('Pick people to remove.');
    const people = await Promise.all(
      participantIds
        .slice(0, SELECT_OPTION_LIMIT)
        .map((id) => resolvePerson(client, ticket.clientGuildId, id)),
    );
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId(TicketComponentIds.removePeopleSelect, ticket.id))
          .setPlaceholder('Remove people')
          .setMaxValues(people.length)
          .addOptions(
            people.map((person) => ({
              label: truncate(person.name, OPTION_LABEL_LIMIT),
              value: person.id,
            })),
          ),
      ),
    );
  }

  return { content: lines.join(' '), components: rows };
}
