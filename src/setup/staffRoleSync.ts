import type { Client, Role } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import type { ClientServer } from '../db/schema.js';
import { syncStaffRoleOverwrites } from '../tickets/permissions.js';

export function validateStaffRole(role: Role): void {
  if (role.id === role.guild.id) throw new UserFacingError('@everyone can’t be a staff role.');
  if (role.managed) throw new UserFacingError('That role belongs to an app and can’t be used.');
}

/** Applies staff role changes to open tickets. Returns false if that failed. */
export async function applyStaffRolesToTickets(
  client: Client<true>,
  server: ClientServer,
): Promise<boolean> {
  try {
    await syncStaffRoleOverwrites(client, server);
    return true;
  } catch (error) {
    logger.error(`Failed to update staff roles on the tickets of ${server.guildId}`, error);
    return false;
  }
}

export const STAFF_SYNC_FAILED_NOTE = '⚠️ Saved, but I couldn’t update the open tickets.';
