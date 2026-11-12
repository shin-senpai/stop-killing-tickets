import { describe, expect, it } from 'vitest';
import { openingFilesMessage, type CapturedFile } from './openingFiles.js';

function file(name: string, size: number, downloaded = true): CapturedFile {
  return {
    name,
    url: `https://cdn.example/${name}`,
    size,
    description: null,
    data: downloaded ? Buffer.alloc(size) : null,
  };
}

describe('openingFilesMessage', () => {
  it('is null without files', () => expect(openingFilesMessage([], 100)).toBeNull());

  it('uploads files that fit and links the rest', () => {
    const message = openingFilesMessage([file('a.png', 60), file('b.png', 60)], 100);
    expect(message?.files).toHaveLength(1);
    expect(message?.content).toContain('[b.png](<https://cdn.example/b.png>)');
    expect(message?.content).not.toContain('a.png');
  });

  it('links files that were not downloaded', () => {
    const message = openingFilesMessage([file('big.mp4', 500, false)], 100);
    expect(message?.files).toHaveLength(0);
    expect(message?.content).toContain('big.mp4');
  });
});
