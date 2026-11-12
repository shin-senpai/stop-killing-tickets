import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../../../core/errors.js';
import type { SlashCommand } from '../../../core/module.js';
import { requireHubAdmin } from '../../guards.js';
import { GLOBAL_BLACKLIST_SCOPE } from '../../repo.js';
import { runSubcommand, type CommandInteraction } from '../subcommands.js';
import { addReasonOption, addToBlacklist, removeFromBlacklist, showBlacklist } from './shared.js';

const USER_ID_PATTERN = /^\d{17,20}$/;

const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Block people from opening tickets in every server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    addReasonOption(
      sub
        .setName('add')
        .setDescription('Block someone everywhere')
        .addStringOption((option) =>
          option.setName('user-id').setDescription('Their user ID').setRequired(true),
        ),
    ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Unblock someone everywhere')
      .addStringOption((option) =>
        option.setName('user-id').setDescription('Their user ID').setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Show people blocked everywhere'))
  .toJSON();

function readUserId(interaction: CommandInteraction): string {
  const value = interaction.options
    .getString('user-id', true)
    .trim()
    .replace(/^<@!?|>$/g, '');
  if (!USER_ID_PATTERN.test(value)) throw new UserFacingError('That doesn’t look like a user ID.');
  return value;
}

async function add(interaction: CommandInteraction): Promise<void> {
  await addToBlacklist(interaction, GLOBAL_BLACKLIST_SCOPE, readUserId(interaction));
}

async function remove(interaction: CommandInteraction): Promise<void> {
  await removeFromBlacklist(interaction, GLOBAL_BLACKLIST_SCOPE, readUserId(interaction));
}

async function list(interaction: CommandInteraction): Promise<void> {
  await showBlacklist(interaction, GLOBAL_BLACKLIST_SCOPE, 'Blocked everywhere');
}

export const hubBlacklistCommand: SlashCommand = {
  scope: 'hub',
  data,
  async execute(interaction) {
    requireHubAdmin(interaction.member);
    await runSubcommand(interaction, { add, remove, list });
  },
};
