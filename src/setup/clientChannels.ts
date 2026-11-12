import type { CategoryChannel, Guild, TextChannel } from 'discord.js';
import { withChannelPermissionHint } from './channelErrors.js';
import { createIntakeChannel, createTicketCategory, lockTicketCategory } from './channels.js';

export function prepareTicketCategory(
  guild: Guild,
  chosen: CategoryChannel | undefined,
): Promise<CategoryChannel> {
  if (!chosen) {
    return withChannelPermissionHint(
      () => createTicketCategory(guild),
      'I couldn’t create the ticket category.',
    );
  }
  return withChannelPermissionHint(async () => {
    await lockTicketCategory(chosen);
    return chosen;
  }, `I couldn’t lock ${chosen} for ticket use.`);
}

export function prepareIntakeChannel(
  guild: Guild,
  chosen: TextChannel | undefined,
): Promise<TextChannel> {
  if (chosen) return Promise.resolve(chosen);
  return withChannelPermissionHint(
    () => createIntakeChannel(guild),
    'I couldn’t create the intake channel.',
  );
}
