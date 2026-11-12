import { MessageFlags, type Interaction, type RepliableInteraction } from 'discord.js';
import { parseCustomId } from './customId.js';
import { UserFacingError } from './errors.js';
import { isHubGuild } from './hub.js';
import { logger } from './logger.js';
import type { BotModule, CommandScope, ComponentHandler, SlashCommand } from './module.js';

function commandKey(scope: CommandScope, name: string): string {
  return `${scope}:${name}`;
}

export function createInteractionRouter(modules: BotModule[]) {
  const commands = new Map<string, SlashCommand>();
  const components = new Map<string, ComponentHandler>();

  for (const module of modules) {
    for (const command of module.commands ?? []) {
      const key = commandKey(command.scope, command.data.name);
      if (commands.has(key)) throw new Error(`Duplicate command: ${key}`);
      commands.set(key, command);
    }
    for (const handler of module.components ?? []) {
      if (components.has(handler.id)) throw new Error(`Duplicate component handler: ${handler.id}`);
      components.set(handler.id, handler);
    }
  }

  function findCommand(guildId: string, name: string): SlashCommand | undefined {
    const scope = isHubGuild(guildId) ? 'hub' : 'client';
    return commands.get(commandKey(scope, name)) ?? commands.get(commandKey('both', name));
  }

  return async function route(interaction: Interaction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    try {
      if (interaction.isChatInputCommand()) {
        const command = findCommand(interaction.guildId, interaction.commandName);
        if (!command) throw new UserFacingError('This command is not available in this server.');
        await command.execute(interaction);
      } else if (interaction.isAutocomplete()) {
        await findCommand(interaction.guildId, interaction.commandName)?.autocomplete?.(
          interaction,
        );
      } else if (
        interaction.isButton() ||
        interaction.isAnySelectMenu() ||
        interaction.isModalSubmit()
      ) {
        const { handlerId, args } = parseCustomId(interaction.customId);
        const handler = components.get(handlerId);
        if (!handler) throw new UserFacingError('This button is no longer active.');
        await handler.handle(interaction, args);
      }
    } catch (error) {
      if (!(error instanceof UserFacingError)) {
        logger.error(`Interaction failed (${describe(interaction)})`, error);
      }
      if (interaction.isRepliable()) {
        const message =
          error instanceof UserFacingError ? error.message : 'Something went wrong. Try again.';
        await replyWithError(interaction, message);
      }
    }
  };
}

function describe(interaction: Interaction): string {
  if (interaction.isCommand() || interaction.isAutocomplete()) return `/${interaction.commandName}`;
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) return interaction.customId;
  return 'unknown interaction';
}

async function replyWithError(interaction: RepliableInteraction, content: string): Promise<void> {
  const allowedMentions = { parse: [] };
  try {
    // `ephemeral` is null after deferUpdate(), where editReply() would overwrite the
    // component's message. After deferReply() a follow-up would leave "thinking…" forever.
    if (interaction.deferred && !interaction.replied && interaction.ephemeral !== null) {
      await interaction.editReply({ content, embeds: [], components: [], allowedMentions });
    } else if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions });
    }
  } catch (error) {
    logger.warn('Failed to send interaction error reply', error);
  }
}
