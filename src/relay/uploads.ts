import { GuildPremiumTier } from 'discord.js';

const MIB = 1024 * 1024;

/** Upload limit for bots and webhooks, by the target server's boost tier. */
export function uploadLimitBytes(tier: GuildPremiumTier): number {
  switch (tier) {
    case GuildPremiumTier.Tier3:
      return 100 * MIB;
    case GuildPremiumTier.Tier2:
      return 50 * MIB;
    default:
      return 10 * MIB;
  }
}

/**
 * Splits files into ones to upload and ones to link. The limit applies to the
 * whole request, so files are added in order until the next one does not fit.
 */
export function splitUploads<T extends { size: number }>(
  files: readonly T[],
  limitBytes: number,
): { upload: T[]; link: T[] } {
  const upload: T[] = [];
  const link: T[] = [];
  let total = 0;
  for (const file of files) {
    if (total + file.size <= limitBytes) {
      upload.push(file);
      total += file.size;
    } else {
      link.push(file);
    }
  }
  return { upload, link };
}
