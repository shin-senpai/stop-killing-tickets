import type { BotModule } from '../core/module.js';
import { approvalComponents } from './approval.js';
import { clientBlacklistCommand } from './commands/blacklist/client.js';
import { hubBlacklistCommand } from './commands/blacklist/hub.js';
import { clientsCommand, unlinkComponents } from './commands/clients/index.js';
import { configCommand, intakeTextModal } from './commands/config/index.js';
import { hubCommand } from './commands/hub/index.js';
import { setupCommand } from './commands/setup.js';
import { registerSetupEvents, syncClientServersOnStartup } from './events.js';

export const setupModule: BotModule = {
  name: 'setup',
  commands: [
    setupCommand,
    configCommand,
    clientBlacklistCommand,
    hubCommand,
    clientsCommand,
    hubBlacklistCommand,
  ],
  components: [...approvalComponents, ...unlinkComponents, intakeTextModal],
  register: registerSetupEvents,
  onReady: syncClientServersOnStartup,
};
