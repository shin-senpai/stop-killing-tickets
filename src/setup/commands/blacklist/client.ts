import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../../../core/errors.js';
import type { SlashCommand } from '../../../core/module.js';
import { requireClientServer, requireServerAdmin } from '../../guards.js';
import { runSubcommand, type CommandInteraction } from '../subcommands.js';
import { addReasonOption, addToBlacklist, removeFromBlacklist, showBlacklist } from './shared.js';

const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Block people from opening tickets in this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    addReasonOption(
      sub
        .setName('add')
        .setDescription('Block someone')
        .addUserOption((option) =>
          option.setName('user').setDescription('Who to block').setRequired(true),
        ),
    ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Unblock someone')
      .addUserOption((option) =>
        option.setName('user').setDescription('Who to unblock').setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Show blocked people'))
  .toJSON();

async function add(interaction: CommandInteraction): Promise<void> {
  const user = interaction.options.getUser('user', true);
  if (user.bot) throw new UserFacingError('Bots can’t open tickets anyway.');
  await addToBlacklist(interaction, interaction.guildId, user.id);
}

async function remove(interaction: CommandInteraction): Promise<void> {
  const user = interaction.options.getUser('user', true);
  await removeFromBlacklist(interaction, interaction.guildId, user.id);
}

async function list(interaction: CommandInteraction): Promise<void> {
  await showBlacklist(interaction, interaction.guildId, 'Blocked in this server');
}

export const clientBlacklistCommand: SlashCommand = {
  scope: 'client',
  data,
  async execute(interaction) {
    requireServerAdmin(interaction.member);
    requireClientServer(interaction.guildId);
    await runSubcommand(interaction, { add, remove, list });
  },
};
