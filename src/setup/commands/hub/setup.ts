import { ChannelType, MessageFlags, type Guild, type TextChannel } from 'discord.js';
import { getHubConfig, updateHubConfig } from '../../../db/queries.js';
import { withChannelPermissionHint } from '../../channelErrors.js';
import {
  createStaffTextChannel,
  findTextChannel,
  LOG_CHANNEL_PERMISSIONS,
} from '../../channels.js';
import { joinLines } from '../../format.js';
import { missingPermissionLine } from '../../permissionReport.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

function useOrCreate(
  guild: Guild,
  chosen: TextChannel | null,
  currentId: string | null,
  defaultName: string,
): Promise<TextChannel> {
  const existing = chosen ?? findTextChannel(guild, currentId);
  if (existing) return Promise.resolve(existing);
  return withChannelPermissionHint(
    () => createStaffTextChannel(guild, defaultName),
    `I couldn’t create #${defaultName}.`,
  );
}

export async function setupHub(interaction: CommandInteraction): Promise<void> {
  const { guild, options } = interaction;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const hub = getHubConfig();

  const log = await useOrCreate(
    guild,
    options.getChannel('log-channel', false, [ChannelType.GuildText]),
    hub.logChannelId,
    'ticket-log',
  );
  const transcripts = await useOrCreate(
    guild,
    options.getChannel('transcript-channel', false, [ChannelType.GuildText]),
    hub.transcriptChannelId,
    'ticket-transcripts',
  );
  updateHubConfig({ logChannelId: log.id, transcriptChannelId: transcripts.id });

  await replyPrivately(
    interaction,
    joinLines(
      '**Hub ready.**',
      `Alerts and link requests: ${log}`,
      `Transcripts: ${transcripts}`,
      missingPermissionLine(log, LOG_CHANNEL_PERMISSIONS),
      missingPermissionLine(transcripts, LOG_CHANNEL_PERMISSIONS),
    ),
  );
}
