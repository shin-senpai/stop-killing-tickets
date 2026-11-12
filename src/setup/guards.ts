import type { GuildMember } from 'discord.js';
import { UserFacingError } from '../core/errors.js';
import { isHubGuild } from '../core/hub.js';
import { isServerAdmin } from '../core/staff.js';
import { getClientServer } from '../db/queries.js';
import type { ClientServer } from '../db/schema.js';
import { findClientByTag } from './repo.js';

export function requireServerAdmin(member: GuildMember): void {
  if (!isServerAdmin(member)) {
    throw new UserFacingError('You need the Manage Server permission to do this.');
  }
}

export function requireHubAdmin(member: GuildMember): void {
  if (!isHubGuild(member.guild.id)) {
    throw new UserFacingError('This only works in the support team server.');
  }
  requireServerAdmin(member);
}

export function requireClientServer(guildId: string): ClientServer {
  const server = getClientServer(guildId);
  if (!server) throw new UserFacingError('This server isn’t set up yet. Run `/setup` first.');
  return server;
}

/** Accepts a guild ID (what autocomplete sends) or a tag (what a person might type). */
export function resolveClientServer(value: string): ClientServer {
  const server = getClientServer(value) ?? findClientByTag(value.toLowerCase());
  if (!server) throw new UserFacingError('I couldn’t find that server. Pick one from the list.');
  return server;
}
