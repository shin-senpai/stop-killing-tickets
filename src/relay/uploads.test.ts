import { GuildPremiumTier } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { splitUploads, uploadLimitBytes } from './uploads.js';

describe('uploadLimitBytes', () => {
  it('uses 10 MiB for unboosted servers', () => {
    expect(uploadLimitBytes(GuildPremiumTier.None)).toBe(10 * 1024 * 1024);
  });
  it('raises the limit for higher tiers', () => {
    expect(uploadLimitBytes(GuildPremiumTier.Tier3)).toBe(100 * 1024 * 1024);
  });
});

describe('splitUploads', () => {
  it('uploads files that fit and links the rest', () => {
    const files = [{ size: 6 }, { size: 6 }, { size: 3 }, { size: 20 }];
    expect(splitUploads(files, 10)).toEqual({
      upload: [{ size: 6 }, { size: 3 }],
      link: [{ size: 6 }, { size: 20 }],
    });
  });
});
