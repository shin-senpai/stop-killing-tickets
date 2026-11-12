import { ChannelType, MessageFlags } from 'discord.js';
import { CATEGORY_CHANNEL_LIMIT } from '../../../core/limits.js';
import {
  childChannelCount,
  INTAKE_CHANNEL_PERMISSIONS,
  LOG_CHANNEL_PERMISSIONS,
} from '../../channels.js';
import { prepareTicketCategory } from '../../clientChannels.js';
import { joinLines } from '../../format.js';
import { requireClientServer } from '../../guards.js';
import { deleteIntakeMessage, refreshIntakeMessage } from '../../intakeMessage.js';
import { missingPermissionLine } from '../../permissionReport.js';
import { saveClientServer } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

export async function setIntakeChannel(interaction: CommandInteraction): Promise<void> {
  const { client, guildId, options } = interaction;
  const server = requireClientServer(guildId);
  const channel = options.getChannel('channel', true, [ChannelType.GuildText]);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (channel.id !== server.intakeChannelId) await deleteIntakeMessage(client, server);
  const updated = saveClientServer(guildId, {
    intakeChannelId: channel.id,
    intakeMessageId: channel.id === server.intakeChannelId ? server.intakeMessageId : null,
  });
  const posted = await refreshIntakeMessage(client, updated);

  await replyPrivately(
    interaction,
    joinLines(
      `People now open tickets in ${channel}.`,
      !posted && `⚠️ I couldn’t post the instructions there.`,
      missingPermissionLine(channel, INTAKE_CHANNEL_PERMISSIONS),
    ),
  );
}

export async function setTicketCategory(interaction: CommandInteraction): Promise<void> {
  const { guild, guildId, options } = interaction;
  requireClientServer(guildId);
  const chosen = options.getChannel('category', true, [ChannelType.GuildCategory]);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const category = await prepareTicketCategory(guild, chosen);
  saveClientServer(guildId, { ticketCategoryId: category.id });

  await replyPrivately(
    interaction,
    joinLines(
      `New tickets will be created in ${category}. I hid it from @everyone.`,
      childChannelCount(category) >= CATEGORY_CHANNEL_LIMIT &&
        `⚠️ ${category} is full (${CATEGORY_CHANNEL_LIMIT} channels).`,
      missingPermissionLine(category),
    ),
  );
}

export async function setLogChannel(interaction: CommandInteraction): Promise<void> {
  const { guildId, options } = interaction;
  requireClientServer(guildId);
  const channel = options.getChannel('channel', false, [ChannelType.GuildText]);
  saveClientServer(guildId, { logChannelId: channel?.id ?? null });

  if (!channel) {
    await replyPrivately(interaction, 'The log channel is turned off.');
    return;
  }
  await replyPrivately(
    interaction,
    joinLines(
      `Ticket notices and transcripts will go to ${channel}.`,
      missingPermissionLine(channel, LOG_CHANNEL_PERMISSIONS),
    ),
  );
}
