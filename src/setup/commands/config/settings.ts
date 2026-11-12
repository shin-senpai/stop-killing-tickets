import type { ClientServer } from '../../../db/schema.js';
import { buildClientConfigEmbed } from '../../configEmbed.js';
import { onOff } from '../../format.js';
import { requireClientServer } from '../../guards.js';
import { refreshIntakeMessage } from '../../intakeMessage.js';
import { saveClientServer } from '../../repo.js';
import { replyPrivately, type CommandInteraction } from '../subcommands.js';

type LimitValues = Partial<
  Pick<
    ClientServer,
    | 'maxOpenTickets'
    | 'minSubjectLength'
    | 'maxParticipants'
    | 'participantsCanAdd'
    | 'cooldownSeconds'
  >
>;

function readLimitOptions({ options }: CommandInteraction): LimitValues {
  const values: LimitValues = {
    maxOpenTickets: options.getInteger('max-open-tickets') ?? undefined,
    minSubjectLength: options.getInteger('min-subject-length') ?? undefined,
    maxParticipants: options.getInteger('max-participants') ?? undefined,
    participantsCanAdd: options.getBoolean('participants-can-add') ?? undefined,
    cooldownSeconds: options.getInteger('cooldown-seconds') ?? undefined,
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

export async function viewConfig(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  await replyPrivately(interaction, '', [buildClientConfigEmbed(server)]);
}

export async function setLimits(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  const changes = readLimitOptions(interaction);
  if (Object.keys(changes).length === 0) {
    await replyPrivately(interaction, '', [buildClientConfigEmbed(server)]);
    return;
  }
  const updated = saveClientServer(server.guildId, changes);
  await replyPrivately(interaction, 'Limits saved.', [buildClientConfigEmbed(updated)]);
  // The default intake text mentions the minimum message length.
  await refreshIntakeMessage(interaction.client, updated);
}

export async function setDmTranscripts(interaction: CommandInteraction): Promise<void> {
  const server = requireClientServer(interaction.guildId);
  const enabled = interaction.options.getBoolean('enabled', true);
  saveClientServer(server.guildId, { dmTranscripts: enabled });
  await replyPrivately(interaction, `DM transcripts are now **${onOff(enabled)}**.`);
}
