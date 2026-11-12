import type { AutocompleteInteraction } from 'discord.js';
import { isHubGuild } from '../../../core/hub.js';
import { isServerAdmin } from '../../../core/staff.js';
import { truncate } from '../../../core/text.js';
import { serverName } from '../../format.js';
import { listClientServers } from '../../repo.js';

const MAX_CHOICES = 25;
const CHOICE_NAME_LIMIT = 100;

export async function autocompleteClientServer(
  interaction: AutocompleteInteraction<'cached'>,
): Promise<void> {
  if (!isHubGuild(interaction.guildId) || !isServerAdmin(interaction.member)) {
    await interaction.respond([]);
    return;
  }
  const query = interaction.options.getFocused().trim().toLowerCase();
  const choices = listClientServers()
    .map((server) => ({ server, name: serverName(interaction.client, server) }))
    .filter(({ server, name }) =>
      [name, server.tag ?? '', server.guildId].some((text) => text.toLowerCase().includes(query)),
    )
    .slice(0, MAX_CHOICES)
    .map(({ server, name }) => ({
      name: truncate(
        `${name}${server.tag ? ` (${server.tag})` : ''} · ${server.status}`,
        CHOICE_NAME_LIMIT,
      ),
      value: server.guildId,
    }));
  await interaction.respond(choices);
}
