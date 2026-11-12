import { padTicketNumber, toChannelSlug, truncate } from '../core/text.js';

const CHANNEL_NAME_LIMIT = 100;
const TOPIC_LIMIT = 1024;
const RENAME_SLUG_LIMIT = 40;

export function clientChannelName(number: number, openerName: string): string {
  return `ticket-${padTicketNumber(number)}-${toChannelSlug(openerName)}`;
}

export function hubChannelName(tag: string, number: number): string {
  return `${tag}-${padTicketNumber(number)}`;
}

/** New names for both channels after `/ticket rename`. The number prefix stays. */
export function renamedChannelNames(
  tag: string,
  number: number,
  name: string,
): { client: string; hub: string } {
  const slug = toChannelSlug(name, RENAME_SLUG_LIMIT);
  return {
    client: truncate(`ticket-${padTicketNumber(number)}-${slug}`, CHANNEL_NAME_LIMIT),
    hub: truncate(`${hubChannelName(tag, number)}-${slug}`, CHANNEL_NAME_LIMIT),
  };
}

export function overflowCategoryName(baseName: string, index: number): string {
  const suffix = ` ${index}`;
  return `${baseName.slice(0, CHANNEL_NAME_LIMIT - suffix.length)}${suffix}`;
}

export function hubChannelTopic(
  serverName: string,
  openerUsername: string,
  openerId: string,
  subject: string,
): string {
  const oneLineSubject = subject.replace(/\s+/g, ' ').trim();
  return truncate(
    `${serverName} · @${openerUsername} (${openerId}) · ${oneLineSubject}`,
    TOPIC_LIMIT,
  );
}
