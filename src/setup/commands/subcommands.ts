import { MessageFlags, type ChatInputCommandInteraction, type EmbedBuilder } from 'discord.js';
import { UserFacingError } from '../../core/errors.js';

export type CommandInteraction = ChatInputCommandInteraction<'cached'>;
export type SubcommandHandler = (interaction: CommandInteraction) => Promise<void>;

/** Keys look like `view` or `staff-roles add`. */
export async function runSubcommand(
  interaction: CommandInteraction,
  handlers: Record<string, SubcommandHandler>,
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const handler = handlers[group ? `${group} ${subcommand}` : subcommand];
  if (!handler) throw new UserFacingError('That command isn’t available.');
  await handler(interaction);
}

export async function replyPrivately(
  interaction: CommandInteraction,
  content: string,
  embeds: EmbedBuilder[] = [],
): Promise<void> {
  const payload = { content, embeds, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}
