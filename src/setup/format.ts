import type { Client } from 'discord.js';
import type { ClientServer } from '../db/schema.js';

export const NOT_SET = '*not set*';

const STATUS_LABELS: Record<ClientServer['status'], string> = {
  pending: '🟡 Waiting for approval',
  active: '🟢 Connected',
  paused: '⏸️ Paused',
  unlinked: '⚫ Not connected',
};

export function statusLabel(status: ClientServer['status']): string {
  return STATUS_LABELS[status];
}

export function serverName(
  client: Client<true>,
  server: Pick<ClientServer, 'guildId' | 'name'>,
): string {
  return (
    client.guilds.cache.get(server.guildId)?.name ??
    server.name ??
    `Unknown server (${server.guildId})`
  );
}

export function channelText(channelId: string | null): string {
  return channelId ? `<#${channelId}>` : NOT_SET;
}

export function roleListText(roleIds: readonly string[]): string {
  return roleIds.length > 0 ? roleIds.map((id) => `<@&${id}>`).join(', ') : NOT_SET;
}

export function onOff(value: boolean): string {
  return value ? 'on' : 'off';
}

/** Skips null, undefined, false and empty strings. */
export function joinLines(...items: (string | null | undefined | false)[]): string {
  return items.filter(Boolean).join('\n');
}
