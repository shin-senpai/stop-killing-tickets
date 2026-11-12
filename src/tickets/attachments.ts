import type { Attachment } from 'discord.js';
import { downloadFile } from '../relay/attachments.js';
import type { CapturedFile } from './openingFiles.js';

/** Must run before the intake message is deleted: Discord removes the files of deleted messages. */
export function captureFiles(
  attachments: readonly Attachment[],
  maxBytes: number,
): Promise<CapturedFile[]> {
  return Promise.all(
    attachments.map(async (attachment) => ({
      name: attachment.name,
      url: attachment.url,
      size: attachment.size,
      description: attachment.description,
      data: attachment.size <= maxBytes ? await downloadFile(attachment.url) : null,
    })),
  );
}
