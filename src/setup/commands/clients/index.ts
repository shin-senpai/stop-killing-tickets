import type { SlashCommand } from '../../../core/module.js';
import { requireHubAdmin } from '../../guards.js';
import { runSubcommand } from '../subcommands.js';
import { autocompleteClientServer } from './autocomplete.js';
import { clientsCommandData } from './definition.js';
import { listClients } from './list.js';
import { approve, pause, reject, resume, setCategory, setTag } from './manage.js';
import { askToUnlink } from './unlink.js';

export const clientsCommand: SlashCommand = {
  scope: 'hub',
  data: clientsCommandData,
  async execute(interaction) {
    requireHubAdmin(interaction.member);
    await runSubcommand(interaction, {
      list: listClients,
      approve,
      reject,
      'set-category': setCategory,
      'set-tag': setTag,
      pause,
      resume,
      unlink: askToUnlink,
    });
  },
  autocomplete: autocompleteClientServer,
};

export { unlinkComponents } from './unlink.js';
