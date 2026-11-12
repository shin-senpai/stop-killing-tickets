import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

/**
 * Where a command is registered:
 * - `hub`: only in the hub server
 * - `client`: only in client servers
 * - `both`: in every server the bot is in
 *
 * The same command name can exist once as `hub` and once as `client`.
 */
export type CommandScope = 'hub' | 'client' | 'both';

export interface SlashCommand {
  scope: CommandScope;
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>): Promise<void>;
}

export type ComponentInteraction =
  | ButtonInteraction<'cached'>
  | AnySelectMenuInteraction<'cached'>
  | ModalSubmitInteraction<'cached'>;

/** Handles buttons, select menus and modals whose custom ID starts with `id` (see customId.ts). */
export interface ComponentHandler {
  id: string;
  handle(interaction: ComponentInteraction, args: string[]): Promise<void>;
}

export interface BotModule {
  name: string;
  commands?: SlashCommand[];
  components?: ComponentHandler[];
  /** Attach gateway event listeners. Called once, before login. */
  register?(client: Client): void;
  /** Called once after the client is ready and commands are registered. */
  onReady?(client: Client<true>): Promise<void>;
}
