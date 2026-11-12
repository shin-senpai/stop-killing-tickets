import { UserFacingError } from '../../../core/errors.js';
import { getHubConfig, updateHubConfig } from '../../../db/queries.js';
import { roleListText } from '../../format.js';
import { validateStaffRole } from '../../staffRoleSync.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

export async function addHubStaffRole(interaction: CommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role', true);
  validateStaffRole(role);
  const { staffRoleIds } = getHubConfig();
  if (staffRoleIds.includes(role.id)) throw new UserFacingError(`${role} is already a staff role.`);
  updateHubConfig({ staffRoleIds: [...staffRoleIds, role.id] });
  await replyPrivately(interaction, `${role} now counts as hub staff.`);
}

export async function removeHubStaffRole(interaction: CommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role', true);
  const { staffRoleIds } = getHubConfig();
  if (!staffRoleIds.includes(role.id)) throw new UserFacingError(`${role} isn’t a staff role.`);
  updateHubConfig({ staffRoleIds: staffRoleIds.filter((id) => id !== role.id) });
  await replyPrivately(interaction, `${role} no longer counts as hub staff.`);
}

export async function listHubStaffRoles(interaction: CommandInteraction): Promise<void> {
  const { staffRoleIds } = getHubConfig();
  const note =
    staffRoleIds.length === 0 ? '\nAnyone who can see a ticket channel counts as staff.' : '';
  await replyPrivately(interaction, `Hub staff roles: ${roleListText(staffRoleIds)}${note}`);
}
