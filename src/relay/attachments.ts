import type { Attachment, AttachmentPayload } from 'discord.js';
import { logger } from '../core/logger.js';

const DOWNLOAD_TIMEOUT_MS = 30_000;

export interface DownloadResult {
  files: AttachmentPayload[];
  failed: Attachment[];
}

/** Failed downloads are returned so they can be linked instead. */
export async function downloadAttachments(
  attachments: readonly Attachment[],
): Promise<DownloadResult> {
  const result: DownloadResult = { files: [], failed: [] };
  for (const attachment of attachments) {
    const data = await downloadFile(attachment.url);
    if (data) {
      result.files.push({
        attachment: data,
        name: attachment.name,
        description: attachment.description ?? undefined,
      });
    } else {
      result.failed.push(attachment);
    }
  }
  return result;
}

/** Returns null on failure. The timeout keeps a stalled download from blocking the ticket's queue. */
export async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    logger.warn(`Failed to download attachment ${url}`, error);
    return null;
  }
}
