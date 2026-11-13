import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type SlashCommandSubcommandGroupBuilder,
} from 'discord.js';

const NOTE_PREFIX_MAX_LENGTH = 10;
const MAX_HOURS = 24 * 30;
const MAX_GRACE_MINUTES = 24 * 60;

function hubConfigGroup(group: SlashCommandSubcommandGroupBuilder) {
  return group
    .setName('config')
    .setDescription('Hub-wide ticket settings')
    .addSubcommand((sub) => sub.setName('view').setDescription('Show hub settings'))
    .addSubcommand((sub) =>
      sub
        .setName('staff-identity')
        .setDescription('How staff names appear to users')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Name style')
            .setRequired(true)
            .addChoices(
              { name: 'Named: "Bob · Support"', value: 'named' },
              { name: 'Anonymous: "Support Team"', value: 'anonymous' },
              { name: 'Role: "Support Team · Moderator"', value: 'role' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('note-prefix')
        .setDescription('Messages starting with this stay internal')
        .addStringOption((option) =>
          option
            .setName('prefix')
            .setDescription('For example //')
            .setRequired(true)
            .setMaxLength(NOTE_PREFIX_MAX_LENGTH),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('auto-close')
        .setDescription('Close tickets when the user stops answering')
        .addIntegerOption((option) =>
          option
            .setName('warn-hours')
            .setDescription('Hours after a staff reply before the user is asked')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_HOURS),
        )
        .addIntegerOption((option) =>
          option
            .setName('close-hours')
            .setDescription('Hours after the question before the ticket closes')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_HOURS),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('auto-close-off').setDescription('Turn off closing for inactivity'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('archive-mode')
        .setDescription('What happens to hub channels after a ticket closes')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Delete or move')
            .setRequired(true)
            .addChoices(
              { name: 'Delete the channel', value: 'delete' },
              { name: 'Move it to a closed category', value: 'move' },
            ),
        )
        .addChannelOption((option) =>
          option
            .setName('closed-category')
            .setDescription('Category for closed tickets (I create one if needed)')
            .addChannelTypes(ChannelType.GuildCategory),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('grace-period')
        .setDescription('Minutes a closed ticket can be reopened')
        .addIntegerOption((option) =>
          option
            .setName('minutes')
            .setDescription('Minutes')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(MAX_GRACE_MINUTES),
        ),
    );
}

function staffRolesGroup(group: SlashCommandSubcommandGroupBuilder) {
  return group
    .setName('staff-roles')
    .setDescription('Roles that count as hub staff')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a hub staff role')
        .addRoleOption((option) =>
          option.setName('role').setDescription('The role').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a hub staff role')
        .addRoleOption((option) =>
          option.setName('role').setDescription('The role').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List hub staff roles'));
}

export const hubCommandData = new SlashCommandBuilder()
  .setName('hub')
  .setDescription('Set up and configure the support hub')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('setup')
      .setDescription('Set the log and transcript channels')
      .addChannelOption((option) =>
        option
          .setName('log-channel')
          .setDescription('For alerts and link requests (I create one if empty)')
          .addChannelTypes(ChannelType.GuildText),
      )
      .addChannelOption((option) =>
        option
          .setName('transcript-channel')
          .setDescription('For ticket transcripts (I create one if empty)')
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('invite').setDescription('Show the link to add me to a client server'),
  )
  .addSubcommand((sub) =>
    sub.setName('check').setDescription('Check hub channels, categories and permissions'),
  )
  .addSubcommandGroup(hubConfigGroup)
  .addSubcommandGroup(staffRolesGroup)
  .toJSON();
