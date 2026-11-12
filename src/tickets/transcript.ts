import { AttachmentBuilder, EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { createTranscript, ExportReturnType } from 'discord-html-transcripts';
import { Colors } from '../core/colors.js';
import { padTicketNumber } from '../core/text.js';
import { getClientServer, getHubConfig } from '../db/queries.js';
import type { Ticket, TicketSide } from '../db/schema.js';
import { fetchSideChannel, runStep } from './channels.js';
import { resolveActor } from './notices.js';
import { actorLabel, formatDuration, ticketLabel, type Actor } from './noticeText.js';

/**
 * discord-html-transcripts is CommonJS, so TypeScript resolves its discord.js
 * types to the CJS declarations, which do not match ours. The channel is the
 * same object at runtime.
 */
type TranscriptSource = Parameters<typeof createTranscript>[0];

interface TranscriptContext {
  ticket: Ticket;
  serverName: string;
  tag: string | null;
  closer: Actor | null;
}

/**
 * Sends the close transcripts from the given sides that still exist. The hub
 * always gets one: from the hub channel if it exists, else from the client one.
 */
export async function deliverTranscripts(
  client: Client<true>,
  ticket: Ticket,
  sides: readonly TicketSide[] = ['client', 'hub'],
): Promise<void> {
  const context = await loadTranscriptContext(client, ticket);
  const hubChannel = sides.includes('hub') ? await fetchSideChannel(client, ticket, 'hub') : null;
  const clientChannel = sides.includes('client')
    ? await fetchSideChannel(client, ticket, 'client')
    : null;

  const hubSource = hubChannel ?? clientChannel;
  if (hubSource) {
    await runStep(`hub transcript for ticket ${ticket.id}`, () =>
      sendHubTranscript(client, context, hubSource),
    );
  }
  if (clientChannel) {
    await runStep(`client transcript for ticket ${ticket.id}`, () =>
      sendClientTranscripts(client, context, clientChannel),
    );
  }
}

async function loadTranscriptContext(
  client: Client<true>,
  ticket: Ticket,
): Promise<TranscriptContext> {
  const server = getClientServer(ticket.clientGuildId);
  return {
    ticket,
    serverName:
      client.guilds.cache.get(ticket.clientGuildId)?.name ?? server?.name ?? 'Unknown server',
    tag: server?.tag ?? null,
    closer: ticket.closedBy ? await resolveActor(client, ticket, ticket.closedBy) : null,
  };
}

async function buildTranscript(channel: TextChannel, fileName: string): Promise<AttachmentBuilder> {
  const html = await createTranscript(channel as unknown as TranscriptSource, {
    limit: -1,
    poweredBy: false,
    returnType: ExportReturnType.Buffer,
  });
  return new AttachmentBuilder(html, { name: fileName });
}

async function sendHubTranscript(
  client: Client<true>,
  context: TranscriptContext,
  source: TextChannel,
): Promise<void> {
  const { transcriptChannelId } = getHubConfig();
  if (!transcriptChannelId) return;
  const destination = await client.channels.fetch(transcriptChannelId);
  if (!destination?.isSendable()) return;

  const file = await buildTranscript(source, transcriptFileName(context, 'hub'));
  await destination.send({
    embeds: [summaryEmbed(context, 'hub')],
    files: [file],
    allowedMentions: { parse: [] },
  });
}

async function sendClientTranscripts(
  client: Client<true>,
  context: TranscriptContext,
  source: TextChannel,
): Promise<void> {
  const server = getClientServer(context.ticket.clientGuildId);
  if (!server) return;
  const logChannel = server.logChannelId
    ? source.guild.channels.cache.get(server.logChannelId)
    : undefined;
  const log = logChannel?.isSendable() ? logChannel : undefined;
  if (!log && !server.dmTranscripts) return;

  const file = await buildTranscript(source, transcriptFileName(context, 'client'));
  const embed = summaryEmbed(context, 'client');

  if (log) {
    await runStep(`client log transcript for ticket ${context.ticket.id}`, () =>
      log.send({ embeds: [embed], files: [file], allowedMentions: { parse: [] } }),
    );
  }
  if (server.dmTranscripts) {
    await client.users
      .send(context.ticket.openerId, {
        content: `Your ticket in **${context.serverName}** was closed. Here's a copy of the conversation.`,
        embeds: [embed],
        files: [file],
      })
      .catch(() => undefined);
  }
}

function transcriptFileName({ ticket, tag }: TranscriptContext, audience: TicketSide): string {
  const name =
    audience === 'hub'
      ? ticketLabel(tag, ticket.number)
      : `ticket-${padTicketNumber(ticket.number)}`;
  return `${name}.html`;
}

function summaryEmbed(context: TranscriptContext, audience: TicketSide): EmbedBuilder {
  const { ticket, closer } = context;
  const title =
    audience === 'hub'
      ? `Ticket ${ticketLabel(context.tag, ticket.number)}`
      : `Ticket #${padTicketNumber(ticket.number)}`;
  const closedBy = closer ? actorLabel(closer, audience) : 'Closed automatically';
  const openFor = (ticket.closedAt ?? new Date()).getTime() - ticket.createdAt.getTime();

  return new EmbedBuilder()
    .setColor(Colors.closed)
    .setTitle(title)
    .addFields(
      { name: 'Server', value: context.serverName, inline: true },
      { name: 'Opened by', value: `<@${ticket.openerId}>`, inline: true },
      { name: 'Closed by', value: closedBy, inline: true },
      { name: 'Reason', value: ticket.closeReason ?? 'No reason given' },
      { name: 'Open for', value: formatDuration(openFor), inline: true },
    )
    .setTimestamp(ticket.closedAt ?? new Date());
}
