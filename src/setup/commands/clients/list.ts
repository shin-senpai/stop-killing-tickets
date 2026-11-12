import { EmbedBuilder, type Client } from 'discord.js';
import { Colors } from '../../../core/colors.js';
import { EMBED_DESCRIPTION_LIMIT } from '../../../core/limits.js';
import { truncate } from '../../../core/text.js';
import type { ClientServer } from '../../../db/schema.js';
import { channelText, serverName, statusLabel } from '../../format.js';
import { countActiveTicketsByClient, listClientServers } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

const STATUS_ORDER: ClientServer['status'][] = ['pending', 'active', 'paused', 'unlinked'];

function clientLine(client: Client<true>, server: ClientServer, openTickets: number): string {
  const tag = server.tag ? `\`${server.tag}\`` : 'no tag';
  return [
    `**${serverName(client, server)}**`,
    tag,
    statusLabel(server.status),
    channelText(server.hubCategoryId),
    `${openTickets} open`,
  ].join(' · ');
}

export async function listClients(interaction: CommandInteraction): Promise<void> {
  const { client } = interaction;
  const openCounts = countActiveTicketsByClient();
  const servers = listClientServers().sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  const description =
    servers.length > 0
      ? servers.map((server) => clientLine(client, server, openCounts.get(server.guildId) ?? 0))
      : ['No servers have run `/setup` yet.'];
  const embed = new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle(`Community servers (${servers.length})`)
    .setDescription(truncate(description.join('\n'), EMBED_DESCRIPTION_LIMIT));
  await replyPrivately(interaction, '', [embed]);
}
