export const MESSAGE_LIMIT = 2000;
export const WEBHOOK_USERNAME_LIMIT = 80;

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Splits text into chunks of at most `max` characters. Prefers to split at a
 * newline, then at a space, so words and lines stay whole where possible.
 */
export function chunkText(text: string, max = MESSAGE_LIMIT): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf('\n');
    if (cut < max / 2) cut = window.lastIndexOf(' ');
    if (cut < max / 2) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^[\n ]/, '');
  }
  if (rest.length > 0 || chunks.length === 0) chunks.push(rest);
  return chunks;
}

/**
 * Discord rejects webhook usernames that contain "discord" or "clyde", or that
 * equal "everyone" or "here". This makes any display name safe to use.
 */
export function sanitizeWebhookUsername(name: string): string {
  let safe = name
    .replace(/discord/gi, (m) => m.replace(/o/i, '0'))
    .replace(/clyde/gi, (m) => m.replace(/l/i, '1'))
    .trim();
  if (/^(everyone|here)$/i.test(safe)) safe = `${safe}_`;
  if (safe.length === 0) safe = 'Unknown';
  return truncate(safe, WEBHOOK_USERNAME_LIMIT);
}

export function padTicketNumber(number: number): string {
  return String(number).padStart(4, '0');
}

/** Lowercase, Discord-safe channel name fragment. */
export function toChannelSlug(text: string, max = 20): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, max).replace(/-+$/, '') || 'user';
}
