import { OAuth2Scopes } from 'discord.js';
import { INVITE_PERMISSIONS } from '../../../core/permissions.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

export async function showInviteLink(interaction: CommandInteraction): Promise<void> {
  const link = interaction.client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: INVITE_PERMISSIONS,
  });
  await replyPrivately(
    interaction,
    [
      `Use this link to add me to a client server:\n${link}`,
      'You need Manage Server in that server. After that, run `/setup` there and approve the request here.',
    ].join('\n\n'),
  );
}
