import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
} from 'discord.js';
import { getClientServer, updateClientServer } from '../../db/queries.js';
import type { ClientServer } from '../../db/schema.js';
import type { SlashCommand } from '../../core/module.js';
import {
  findCategory,
  findTextChannel,
  INTAKE_CHANNEL_PERMISSIONS,
  LOG_CHANNEL_PERMISSIONS,
} from '../channels.js';
import { prepareIntakeChannel, prepareTicketCategory } from '../clientChannels.js';
import { buildClientConfigEmbed } from '../configEmbed.js';
import { requireServerAdmin } from '../guards.js';
import { deleteIntakeMessage, refreshIntakeMessage } from '../intakeMessage.js';
import { linkRequestExists, sendLinkRequest } from '../linkRequest.js';
import { missingGuildPermissionLine, missingPermissionLine } from '../permissionReport.js';
import { insertClientServer, saveClientServer } from '../repo.js';
import {
  applyStaffRolesToTickets,
  STAFF_SYNC_FAILED_NOTE,
  validateStaffRole,
} from '../staffRoleSync.js';

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Set up tickets in this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addChannelOption((option) =>
    option
      .setName('category')
      .setDescription('Category for ticket channels (I create one if you leave this empty)')
      .addChannelTypes(ChannelType.GuildCategory),
  )
  .addChannelOption((option) =>
    option
      .setName('intake-channel')
      .setDescription('Where people open tickets (I create one if you leave this empty)')
      .addChannelTypes(ChannelType.GuildText),
  )
  .addRoleOption((option) =>
    option.setName('staff-role').setDescription('A role that can see and answer tickets'),
  )
  .addChannelOption((option) =>
    option
      .setName('log-channel')
      .setDescription('Where ticket notices and transcripts go')
      .addChannelTypes(ChannelType.GuildText),
  )
  .toJSON();

type SetupInteraction = ChatInputCommandInteraction<'cached'>;

interface SetupChoices {
  ticketCategoryId: string;
  intakeChannelId: string;
  logChannelId: string | null;
  staffRoleIds: string[];
}

async function collectChoices(
  interaction: SetupInteraction,
  existing: ClientServer | undefined,
): Promise<SetupChoices> {
  const { guild, options } = interaction;
  const role = options.getRole('staff-role');
  if (role) validateStaffRole(role);

  const category = await prepareTicketCategory(
    guild,
    options.getChannel('category', false, [ChannelType.GuildCategory]) ??
      findCategory(guild, existing?.ticketCategoryId ?? null),
  );
  const intake = await prepareIntakeChannel(
    guild,
    options.getChannel('intake-channel', false, [ChannelType.GuildText]) ??
      findTextChannel(guild, existing?.intakeChannelId ?? null),
  );
  const log =
    options.getChannel('log-channel', false, [ChannelType.GuildText]) ??
    findTextChannel(guild, existing?.logChannelId ?? null);

  const staffRoleIds = new Set(existing?.staffRoleIds ?? []);
  if (role) staffRoleIds.add(role.id);

  return {
    ticketCategoryId: category.id,
    intakeChannelId: intake.id,
    logChannelId: log?.id ?? null,
    staffRoleIds: [...staffRoleIds],
  };
}

// Re-reads the row because a hub admin may have changed its status while the
// channels were being prepared. Only an unlinked server goes back to pending.
async function saveChoices(
  client: Client<true>,
  guild: Guild,
  choices: SetupChoices,
): Promise<ClientServer> {
  const current = getClientServer(guild.id);
  if (!current) {
    return insertClientServer({
      guildId: guild.id,
      name: guild.name,
      status: 'pending',
      ...choices,
    });
  }
  const intakeMoved = current.intakeChannelId !== choices.intakeChannelId;
  const values: Partial<ClientServer> = { ...choices, name: guild.name };
  if (intakeMoved) values.intakeMessageId = null;
  if (current.status === 'unlinked') {
    values.status = 'pending';
    values.linkRequestMessageId = null;
  }
  const saved = saveClientServer(guild.id, values);
  if (intakeMoved) await deleteIntakeMessage(client, current);
  return saved;
}

async function requestLinkIfNeeded(
  client: Client<true>,
  guild: Guild,
  server: ClientServer,
): Promise<string | null> {
  if (server.status !== 'pending') return null;
  if (await linkRequestExists(client, server)) {
    return 'The support team still needs to approve this server.';
  }
  const messageId = await sendLinkRequest(client, guild);
  if (!messageId) return '⚠️ I couldn’t reach the support team. Run `/setup` again later.';
  updateClientServer(server.guildId, { linkRequestMessageId: messageId });
  return 'I asked the support team to connect this server. You’ll see it in the intake channel once they approve.';
}

function permissionWarnings(guild: Guild, server: ClientServer): string[] {
  const category = findCategory(guild, server.ticketCategoryId);
  const intake = findTextChannel(guild, server.intakeChannelId);
  const log = findTextChannel(guild, server.logChannelId);
  return [
    missingGuildPermissionLine(guild.members.me),
    category && missingPermissionLine(category),
    intake && missingPermissionLine(intake, INTAKE_CHANNEL_PERMISSIONS),
    log && missingPermissionLine(log, LOG_CHANNEL_PERMISSIONS),
  ].filter((line): line is string => Boolean(line));
}

export const setupCommand: SlashCommand = {
  scope: 'client',
  data,
  async execute(interaction) {
    requireServerAdmin(interaction.member);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { client, guild } = interaction;

    const existing = getClientServer(guild.id);
    const choices = await collectChoices(interaction, existing);
    const server = await saveChoices(client, guild, choices);

    const notes: string[] = [];
    const rolesChanged = existing && existing.staffRoleIds.length !== server.staffRoleIds.length;
    if (rolesChanged && !(await applyStaffRolesToTickets(client, server))) {
      notes.push(STAFF_SYNC_FAILED_NOTE);
    }
    if (!(await refreshIntakeMessage(client, server))) {
      notes.push(`⚠️ I couldn’t post the instructions in <#${server.intakeChannelId}>.`);
    }
    const linkNote = await requestLinkIfNeeded(client, guild, server);
    if (linkNote) notes.push(linkNote);
    notes.push(...permissionWarnings(guild, server));

    await interaction.editReply({
      content: ['**Setup saved.**', ...notes].join('\n'),
      embeds: [buildClientConfigEmbed(getClientServer(guild.id) ?? server)],
      allowedMentions: { parse: [] },
    });
  },
};
