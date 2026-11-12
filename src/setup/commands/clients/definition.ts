import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from 'discord.js';
import { TAG_MAX_LENGTH } from '../../linking.js';

export const SERVER_OPTION = 'server';
const PAUSE_MESSAGE_MAX_LENGTH = 500;

function withServer(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.addStringOption((option) =>
    option
      .setName(SERVER_OPTION)
      .setDescription('The community server')
      .setRequired(true)
      .setAutocomplete(true),
  );
}

function withTag(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.addStringOption((option) =>
    option
      .setName('tag')
      .setDescription('Short name for hub channels, like acme')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(TAG_MAX_LENGTH),
  );
}

function withCategory(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.addChannelOption((option) =>
    option
      .setName('category')
      .setDescription('Hub category for this server’s tickets')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildCategory),
  );
}

export const clientsCommandData = new SlashCommandBuilder()
  .setName('clients')
  .setDescription('Manage connected community servers')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub.setName('list').setDescription('Show all servers'))
  .addSubcommand((sub) =>
    withCategory(withTag(withServer(sub.setName('approve').setDescription('Connect a server')))),
  )
  .addSubcommand((sub) =>
    withServer(sub.setName('reject').setDescription('Decline a connection request')),
  )
  .addSubcommand((sub) =>
    withCategory(
      withServer(
        sub.setName('set-category').setDescription('Move new tickets to another category'),
      ),
    ),
  )
  .addSubcommand((sub) =>
    withTag(withServer(sub.setName('set-tag').setDescription('Change a server’s tag'))),
  )
  .addSubcommand((sub) =>
    withServer(sub.setName('pause').setDescription('Stop new tickets for a while')).addStringOption(
      (option) =>
        option
          .setName('message')
          .setDescription('What users see while paused')
          .setMaxLength(PAUSE_MESSAGE_MAX_LENGTH),
    ),
  )
  .addSubcommand((sub) =>
    withServer(sub.setName('resume').setDescription('Allow new tickets again')),
  )
  .addSubcommand((sub) =>
    withServer(sub.setName('unlink').setDescription('Disconnect a server and close its tickets')),
  )
  .toJSON();
