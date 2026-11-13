import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  userMention,
  type Client,
} from 'discord.js';
import { Colors } from '../core/colors.js';
import { customId } from '../core/customId.js';
import { resolveStaffLabel } from '../core/staffIdentity.js';
import type { HubConfig, Ticket, TicketSide } from '../db/schema.js';
import { sendToTicketChannel } from './channels.js';
import { finalizeNowButton } from './starterView.js';
import { TicketComponentIds } from './ids.js';
import { closeNoticeText, reopenNoticeText, type Actor } from './noticeText.js';

const SIDES: readonly TicketSide[] = ['client', 'hub'];

export interface TicketNotice {
  client: string;
  hub: string;
  /** Users to ping on the client side, for example people who were just added. */
  pingUserIds?: string[];
}

/**
 * Members of the client server are mentioned there. Anyone else is hub staff,
 * whose mention would not resolve in the client server, so they are named by
 * the staff identity mode instead.
 */
export async function resolveActor(
  client: Client<true>,
  ticket: Ticket,
  userId: string,
): Promise<Actor> {
  const clientGuild = client.guilds.cache.get(ticket.clientGuildId);
  const isClientMember =
    userId === ticket.openerId ||
    (await clientGuild?.members.fetch(userId).catch(() => null)) != null;
  return {
    id: userId,
    clientLabel: isClientMember ? userMention(userId) : await resolveStaffLabel(client, userId),
  };
}

function noticeEmbed(description: string, color: number = Colors.info): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setDescription(description);
}

/** Bot messages are never relayed, so each side gets its own copy. */
export async function postNotice(
  client: Client<true>,
  ticket: Ticket,
  side: TicketSide,
  text: string,
  color: number = Colors.info,
): Promise<void> {
  await sendToTicketChannel(client, ticket, side, { embeds: [noticeEmbed(text, color)] });
}

export async function postTicketNotice(
  client: Client<true>,
  ticket: Ticket,
  notice: TicketNotice,
): Promise<void> {
  const pings = notice.pingUserIds ?? [];
  await Promise.all([
    sendToTicketChannel(client, ticket, 'client', {
      content: pings.length > 0 ? pings.map(userMention).join(' ') : undefined,
      embeds: [noticeEmbed(notice.client)],
      allowedMentions: { users: pings },
    }),
    postNotice(client, ticket, 'hub', notice.hub),
  ]);
}

/** Only the hub side gets Close now, because only hub staff may end the grace period. */
function reopenButtonRow(ticketId: number, side: TicketSide): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(TicketComponentIds.reopen, ticketId))
      .setLabel('Reopen')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),
  );
  if (side === 'hub') row.addComponents(finalizeNowButton({ id: ticketId }));
  return row;
}

function hubChannelFate(hub: HubConfig): 'deleted' | 'archived' {
  return hub.archiveMode === 'move' && hub.closedCategoryId ? 'archived' : 'deleted';
}

export async function postCloseNotices(
  client: Client<true>,
  ticket: Ticket,
  closer: Actor | null,
  hub: HubConfig,
  { reopenable }: { reopenable: boolean },
): Promise<void> {
  const closingUntil = ticket.closingUntil ?? new Date();
  await Promise.all(
    SIDES.map((side) => {
      const text = closeNoticeText({
        closer,
        reason: ticket.closeReason,
        closingUntil,
        audience: side,
        channelFate: side === 'hub' ? hubChannelFate(hub) : 'deleted',
      });
      return sendToTicketChannel(client, ticket, side, {
        embeds: [noticeEmbed(text, Colors.closing)],
        components: reopenable ? [reopenButtonRow(ticket.id, side)] : [],
      });
    }),
  );
}

export async function postReopenNotices(
  client: Client<true>,
  ticket: Ticket,
  actor: Actor,
): Promise<void> {
  await Promise.all(
    SIDES.map((side) =>
      postNotice(client, ticket, side, reopenNoticeText(actor, side), Colors.open),
    ),
  );
}
