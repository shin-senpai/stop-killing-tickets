import type { SlashCommand } from '../../../core/module.js';
import { requireHubAdmin } from '../../guards.js';
import { runSubcommand } from '../subcommands.js';
import {
  disableAutoClose,
  setArchiveMode,
  setAutoClose,
  setGracePeriod,
  setNotePrefix,
  setStaffIdentity,
  viewHubConfig,
} from './config.js';
import { runHubHealthCheck } from './check.js';
import { hubCommandData } from './definition.js';
import { showInviteLink } from './invite.js';
import { setupHub } from './setup.js';
import { addHubStaffRole, listHubStaffRoles, removeHubStaffRole } from './staffRoles.js';

export const hubCommand: SlashCommand = {
  scope: 'hub',
  data: hubCommandData,
  async execute(interaction) {
    requireHubAdmin(interaction.member);
    await runSubcommand(interaction, {
      setup: setupHub,
      invite: showInviteLink,
      check: runHubHealthCheck,
      'config view': viewHubConfig,
      'config staff-identity': setStaffIdentity,
      'config note-prefix': setNotePrefix,
      'config auto-close': setAutoClose,
      'config auto-close-off': disableAutoClose,
      'config archive-mode': setArchiveMode,
      'config grace-period': setGracePeriod,
      'staff-roles add': addHubStaffRole,
      'staff-roles remove': removeHubStaffRole,
      'staff-roles list': listHubStaffRoles,
    });
  },
};
