import { describe, expect, it } from 'vitest';
import { rewriteMentions, type MentionNames } from './mentions.js';

const names: MentionNames = {
  user: (id) => ({ '111': 'Alice', '222': '<@111>' })[id],
  role: (id) => ({ '333': 'Moderators' })[id],
  channel: (id) => ({ '444': 'general' })[id],
};

describe('rewriteMentions', () => {
  it('rewrites user mentions, with or without the nickname marker', () => {
    expect(rewriteMentions('hi <@111> and <@!111>', names)).toBe('hi @Alice and @Alice');
  });

  it('rewrites role and channel mentions', () => {
    expect(rewriteMentions('<@&333> see <#444>', names)).toBe('@Moderators see #general');
  });

  it('uses fallbacks for unknown IDs', () => {
    expect(rewriteMentions('<@9> <@&9> <#9>', names)).toBe(
      '@unknown-user @unknown-role #unknown-channel',
    );
  });

  it('does not parse names it inserted', () => {
    expect(rewriteMentions('<@222>', names)).toBe('@<@111>');
  });

  it('leaves other markup alone', () => {
    const text = '@everyone <t:1700000000:R> <:wave:555> </help:666>';
    expect(rewriteMentions(text, names)).toBe(text);
  });
});
