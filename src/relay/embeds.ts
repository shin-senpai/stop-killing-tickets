import { EmbedType, type APIEmbed } from 'discord.js';

const MAX_EMBEDS = 10;

/**
 * Embeds the author made. Link previews are left out because Discord makes
 * them again for the relayed text. Some link previews have the type "rich",
 * so a rich embed whose URL appears in the text also counts as a preview.
 */
export function authorEmbeds(embeds: readonly APIEmbed[], content: string): APIEmbed[] {
  return embeds
    .filter((embed) => embed.type === EmbedType.Rich && !(embed.url && content.includes(embed.url)))
    .slice(0, MAX_EMBEDS);
}
