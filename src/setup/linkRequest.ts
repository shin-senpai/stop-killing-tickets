import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type Guild,
  type Message,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { customId } from '../core/customId.js';
import { sendHubLog } from '../core/hub.js';
import { logger } from '../core/logger.js';
import { getHubConfig } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { SetupComponentIds } from './ids.js';

/** Returns the message ID, or null if the hub log channel is not reachable. */
export async function sendLinkRequest(client: Client<true>, guild: Guild): Promise<string | null> {
  const embed = new EmbedBuilder()
    .setColor(Colors.closing)
    .setTitle('New server wants to connect')
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: 'Server', value: `${guild.name} (\`${guild.id}\`)` },
      { name: 'Members', value: guild.memberCount.toLocaleString('en-US'), inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}> (\`${guild.ownerId}\`)`, inline: true },
    );
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(SetupComponentIds.linkApprove, guild.id))
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(customId(SetupComponentIds.linkReject, guild.id))
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger),
  );
  const message = await sendHubLog(client, {
    embeds: [embed],
    components: [buttons],
    allowedMentions: { parse: [] },
  });
  return message?.id ?? null;
}

async function fetchLinkRequestMessage(
  client: Client<true>,
  server: ClientServer,
): Promise<Message | null> {
  const { logChannelId } = getHubConfig();
  if (!server.linkRequestMessageId || !logChannelId) return null;
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel?.isTextBased()) return null;
    return await channel.messages.fetch(server.linkRequestMessageId);
  } catch {
    return null;
  }
}

export async function linkRequestExists(
  client: Client<true>,
  server: ClientServer,
): Promise<boolean> {
  return (await fetchLinkRequestMessage(client, server)) !== null;
}

/** Marks the link request as handled and removes its buttons. Never throws. */
export async function resolveLinkRequest(
  client: Client<true>,
  server: ClientServer,
  outcome: string,
  approved: boolean,
): Promise<void> {
  const message = await fetchLinkRequestMessage(client, server);
  if (!message) return;
  const original = message.embeds[0];
  const embed = (original ? EmbedBuilder.from(original) : new EmbedBuilder())
    .setColor(approved ? Colors.open : Colors.closed)
    .addFields({ name: 'Result', value: outcome });
  await message
    .edit({ embeds: [embed], components: [], allowedMentions: { parse: [] } })
    .catch((error) =>
      logger.warn(`Could not update the link request for ${server.guildId}`, error),
    );
}
