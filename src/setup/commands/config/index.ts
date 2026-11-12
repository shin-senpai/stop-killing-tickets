import type { SlashCommand } from '../../../core/module.js';
import { requireServerAdmin } from '../../guards.js';
import { runSubcommand } from '../subcommands.js';
import { setIntakeChannel, setLogChannel, setTicketCategory } from './channels.js';
import { runHealthCheck } from './check.js';
import { configCommandData } from './definition.js';
import { openIntakeMessageModal } from './intakeMessage.js';
import { setDmTranscripts, setLimits, viewConfig } from './settings.js';
import { addStaffRole, listStaffRoles, removeStaffRole } from './staffRoles.js';

export const configCommand: SlashCommand = {
  scope: 'client',
  data: configCommandData,
  async execute(interaction) {
    requireServerAdmin(interaction.member);
    await runSubcommand(interaction, {
      view: viewConfig,
      'intake-channel': setIntakeChannel,
      category: setTicketCategory,
      'staff-roles add': addStaffRole,
      'staff-roles remove': removeStaffRole,
      'staff-roles list': listStaffRoles,
      'log-channel': setLogChannel,
      'intake-message': openIntakeMessageModal,
      limits: setLimits,
      'dm-transcripts': setDmTranscripts,
      check: runHealthCheck,
    });
  },
};

export { intakeTextModal } from './intakeMessage.js';
