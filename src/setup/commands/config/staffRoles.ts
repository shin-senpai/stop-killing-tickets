import { MessageFlags } from 'discord.js';
import { UserFacingError } from '../../../core/errors.js';
import type { ClientServer } from '../../../db/schema.js';
import { joinLines, roleListText } from '../../format.js';
import { requireClientServer } from '../../guards.js';
import { saveClientServer } from '../../repo.js';
import {
  applyStaffRolesToTickets,
  STAFF_SYNC_FAILED_NOTE,
  validateStaffRole,
} from '../../staffRoleSync.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

async function saveStaffRoles(
  interaction: CommandInteraction,
  server: ClientServer,
  staffRoleIds: string[],
  confirmation: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const updated = saveClientServer(server.guildId, { staffRoleIds });
  const synced = await applyStaffRolesToTickets(interaction.client, updated);
  await replyPrivately(interaction, joinLines(confirmation, !synced && STAFF_SYNC_FAILED_NOTE));
}

export async function addStaffRole(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  const role = interaction.options.getRole('role', true);
  validateStaffRole(role);
  if (server.staffRoleIds.includes(role.id)) {
    throw new UserFacingError(`${role} is already a staff role.`);
  }
  await saveStaffRoles(
    interaction,
    server,
    [...server.staffRoleIds, role.id],
    `${role} can now see and answer tickets.`,
  );
}

export async function removeStaffRole(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  const role = interaction.options.getRole('role', true);
  if (!server.staffRoleIds.includes(role.id)) {
    throw new UserFacingError(`${role} isn’t a staff role.`);
  }
  await saveStaffRoles(
    interaction,
    server,
    server.staffRoleIds.filter((id) => id !== role.id),
    `${role} is no longer a staff role.`,
  );
}

export async function listStaffRoles(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  await replyPrivately(interaction, `Staff roles: ${roleListText(server.staffRoleIds)}`);
}
