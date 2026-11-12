import { EmbedBuilder, type SlashCommandSubcommandBuilder } from 'discord.js';
import { Colors } from '../../../core/colors.js';
import { EMBED_DESCRIPTION_LIMIT } from '../../../core/limits.js';
import { truncate } from '../../../core/text.js';
import type { BlacklistEntry } from '../../../db/schema.js';
import { deleteBlacklistEntry, listBlacklist, upsertBlacklistEntry } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

const REASON_MAX_LENGTH = 200;

export function addReasonOption(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub.addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Why this person is blocked')
      .setMaxLength(REASON_MAX_LENGTH),
  );
}

function entryLine(entry: BlacklistEntry): string {
  const added = `<t:${Math.floor(entry.addedAt.getTime() / 1000)}:d>`;
  const reason = entry.reason ? ` · ${entry.reason}` : '';
  return `<@${entry.userId}> (\`${entry.userId}\`) · ${added}${reason}`;
}

export async function addToBlacklist(
  interaction: CommandInteraction,
  scope: string,
  userId: string,
): Promise<void> {
  const reason = interaction.options.getString('reason');
  upsertBlacklistEntry(scope, userId, reason, interaction.user.id);
  await replyPrivately(interaction, `<@${userId}> can no longer open tickets.`);
}

export async function removeFromBlacklist(
  interaction: CommandInteraction,
  scope: string,
  userId: string,
): Promise<void> {
  const removed = deleteBlacklistEntry(scope, userId);
  await replyPrivately(
    interaction,
    removed ? `<@${userId}> can open tickets again.` : `<@${userId}> isn’t on the list.`,
  );
}

export async function showBlacklist(
  interaction: CommandInteraction,
  scope: string,
  title: string,
): Promise<void> {
  const entries = listBlacklist(scope);
  const description =
    entries.length > 0
      ? truncate(entries.map(entryLine).join('\n'), EMBED_DESCRIPTION_LIMIT)
      : 'Nobody is blocked.';
  const embed = new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle(`${title} (${entries.length})`)
    .setDescription(description);
  await replyPrivately(interaction, '', [embed]);
}
