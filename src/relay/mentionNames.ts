import type { Message } from 'discord.js';
import type { MentionNames } from './mentions.js';

export function mentionNamesFor(message: Message<true>): MentionNames {
  return {
    user: (id) =>
      message.mentions.members?.get(id)?.displayName ??
      message.guild.members.cache.get(id)?.displayName ??
      message.mentions.users.get(id)?.displayName ??
      message.client.users.cache.get(id)?.displayName,
    role: (id) => message.guild.roles.cache.get(id)?.name,
    channel: (id) => {
      const channel = message.client.channels.cache.get(id);
      return channel && 'name' in channel ? (channel.name ?? undefined) : undefined;
    },
  };
}
