import type { BotModule } from '../core/module.js';
import { ticketCommand } from './command.js';
import { registerIntake } from './intake.js';
import {
  lifecycleComponents,
  registerLifecycleEvents,
  startLifecycleScheduler,
} from './lifecycle.js';
import { ticketComponents } from './ticketComponents.js';

export const ticketsModule: BotModule = {
  name: 'tickets',
  commands: [ticketCommand],
  components: [...ticketComponents, ...lifecycleComponents],
  register(client) {
    registerIntake(client);
    registerLifecycleEvents(client);
  },
  async onReady(client) {
    startLifecycleScheduler(client);
  },
};
