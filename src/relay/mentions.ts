export interface MentionNames {
  user(id: string): string | undefined;
  role(id: string): string | undefined;
  channel(id: string): string | undefined;
}

const MENTION = /<(@!?|@&|#)(\d+)>/g;

/**
 * Replaces user, role and channel mentions with plain text, because their IDs
 * mean nothing in the other server. One pass, so inserted names are never
 * parsed again.
 */
export function rewriteMentions(content: string, names: MentionNames): string {
  return content.replace(MENTION, (_match, kind: string, id: string) => {
    if (kind === '@&') return `@${names.role(id) ?? 'unknown-role'}`;
    if (kind === '#') return `#${names.channel(id) ?? 'unknown-channel'}`;
    return `@${names.user(id) ?? 'unknown-user'}`;
  });
}
