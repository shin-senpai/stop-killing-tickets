import { SUPPORT_TEAM } from '../core/staffLabel.js';
import { sanitizeWebhookUsername } from '../core/text.js';
import type { HubConfig } from '../db/schema.js';

export interface WebhookIdentity {
  username: string;
  avatarURL: string | undefined;
}

export interface ClientAuthor {
  displayName: string;
  avatarURL: string | undefined;
  /** The client's tag, or the server name if it has no tag yet. */
  serverLabel: string;
  isStaff: boolean;
}

/** How a client server member appears in the hub. */
export function clientAuthorIdentity(author: ClientAuthor): WebhookIdentity {
  const label = author.isStaff ? `${author.serverLabel} Staff` : author.serverLabel;
  return {
    username: sanitizeWebhookUsername(`${author.displayName} (${label})`),
    avatarURL: author.avatarURL,
  };
}

export interface HubAuthor {
  displayName: string;
  avatarURL: string | undefined;
  /** Undefined when the member has no role besides @everyone. */
  topRoleName: string | undefined;
  hubIconURL: string | undefined;
}

/** How a hub staff member appears in a client server, per the staff identity mode. */
export function hubAuthorIdentity(
  mode: HubConfig['staffIdentity'],
  author: HubAuthor,
): WebhookIdentity {
  switch (mode) {
    case 'anonymous':
      return { username: SUPPORT_TEAM, avatarURL: author.hubIconURL };
    case 'role':
      return {
        username: sanitizeWebhookUsername(
          author.topRoleName ? `${SUPPORT_TEAM} · ${author.topRoleName}` : SUPPORT_TEAM,
        ),
        avatarURL: author.avatarURL,
      };
    case 'named':
      return {
        username: sanitizeWebhookUsername(`${author.displayName} · Support`),
        avatarURL: author.avatarURL,
      };
  }
}
