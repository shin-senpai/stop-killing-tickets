export interface CopyRef {
  copyIndex: number;
  copyMessageId: string;
}

export interface CopyEditPlan {
  edits: (CopyRef & { content: string })[];
  deletions: CopyRef[];
  appends: { copyIndex: number; content: string }[];
}

/**
 * Matches the new chunks of an edited message to its existing copies, in
 * order: existing copies are edited, extra copies are deleted, and missing
 * ones are appended with fresh copy indexes.
 */
export function planCopyEdits(
  existing: readonly CopyRef[],
  chunks: readonly string[],
): CopyEditPlan {
  const copies = [...existing].sort((a, b) => a.copyIndex - b.copyIndex);
  const nextIndex = (copies.at(-1)?.copyIndex ?? -1) + 1;
  return {
    edits: copies.slice(0, chunks.length).map((copy, i) => ({ ...copy, content: chunks[i] ?? '' })),
    deletions: copies.slice(chunks.length),
    appends: chunks
      .slice(copies.length)
      .map((content, i) => ({ copyIndex: nextIndex + i, content })),
  };
}
