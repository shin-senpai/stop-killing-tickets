import { AttachmentBuilder, type MessageCreateOptions } from 'discord.js';
import { MESSAGE_LIMIT, truncate } from '../core/text.js';
import { splitUploads } from '../relay/uploads.js';

export interface CapturedFile {
  name: string;
  url: string;
  size: number;
  description: string | null;
  /** Null when the file was too large to download or the download failed. */
  data: Buffer | null;
}

type DownloadedFile = CapturedFile & { data: Buffer };

/** The message that carries the opening files into a ticket channel, or null if there are none. */
export function openingFilesMessage(
  files: readonly CapturedFile[],
  uploadLimitBytes: number,
): MessageCreateOptions | null {
  if (files.length === 0) return null;
  const downloaded = files.filter((file): file is DownloadedFile => file.data !== null);
  const { upload, link } = splitUploads(downloaded, uploadLimitBytes);
  const linked = [...link, ...files.filter((file) => file.data === null)];
  const lines = [
    'Files from the opening message:',
    ...linked.map((file) => `[${file.name}](<${file.url}>) (too large to copy)`),
  ];
  return {
    content: truncate(lines.join('\n'), MESSAGE_LIMIT),
    files: upload.map(
      (file) =>
        new AttachmentBuilder(file.data, {
          name: file.name,
          description: file.description ?? undefined,
        }),
    ),
    allowedMentions: { parse: [] },
  };
}
