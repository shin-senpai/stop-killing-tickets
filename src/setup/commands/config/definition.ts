import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const configCommandData = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Change ticket settings for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub.setName('view').setDescription('Show all settings'))
  .addSubcommand((sub) =>
    sub
      .setName('intake-channel')
      .setDescription('Move the channel where people open tickets')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The new intake channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('category')
      .setDescription('Set the category for new ticket channels')
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('The ticket category')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('staff-roles')
      .setDescription('Roles that can see and answer tickets')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a staff role')
          .addRoleOption((option) =>
            option.setName('role').setDescription('The role').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a staff role')
          .addRoleOption((option) =>
            option.setName('role').setDescription('The role').setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List staff roles')),
  )
  .addSubcommand((sub) =>
    sub
      .setName('log-channel')
      .setDescription('Set where ticket notices and transcripts go')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Leave empty to turn the log off')
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('intake-message').setDescription('Edit the instructions in the intake channel'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('limits')
      .setDescription('Change ticket limits (leave all empty to see them)')
      .addIntegerOption((option) =>
        option
          .setName('max-open-tickets')
          .setDescription('Open tickets one person can have')
          .setMinValue(1)
          .setMaxValue(10),
      )
      .addIntegerOption((option) =>
        option
          .setName('min-subject-length')
          .setDescription('Minimum length of the first message')
          .setMinValue(0)
          .setMaxValue(1000),
      )
      .addIntegerOption((option) =>
        option
          .setName('max-participants')
          .setDescription('People that can be added to one ticket')
          .setMinValue(0)
          .setMaxValue(25),
      )
      .addBooleanOption((option) =>
        option.setName('participants-can-add').setDescription('Let added people add others too'),
      )
      .addIntegerOption((option) =>
        option
          .setName('cooldown-seconds')
          .setDescription('Wait time after closing a ticket before opening a new one')
          .setMinValue(0)
          .setMaxValue(604_800),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('dm-transcripts')
      .setDescription('Send people a transcript by DM when their ticket closes')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('On or off').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('check').setDescription('Check channels and permissions for problems'),
  )
  .toJSON();
