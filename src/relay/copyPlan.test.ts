import { describe, expect, it } from 'vitest';
import { planCopyEdits } from './copyPlan.js';

const copy = (copyIndex: number) => ({ copyIndex, copyMessageId: `m${copyIndex}` });

describe('planCopyEdits', () => {
  it('edits each copy when the chunk count is the same', () => {
    expect(planCopyEdits([copy(1), copy(0)], ['a', 'b'])).toEqual({
      edits: [
        { copyIndex: 0, copyMessageId: 'm0', content: 'a' },
        { copyIndex: 1, copyMessageId: 'm1', content: 'b' },
      ],
      deletions: [],
      appends: [],
    });
  });

  it('deletes copies that are no longer needed', () => {
    const plan = planCopyEdits([copy(0), copy(1), copy(2)], ['a']);
    expect(plan.edits).toEqual([{ copyIndex: 0, copyMessageId: 'm0', content: 'a' }]);
    expect(plan.deletions).toEqual([copy(1), copy(2)]);
    expect(plan.appends).toEqual([]);
  });

  it('appends chunks after the highest existing index', () => {
    const plan = planCopyEdits([copy(0), copy(3)], ['a', 'b', 'c']);
    expect(plan.edits.map((e) => e.copyIndex)).toEqual([0, 3]);
    expect(plan.appends).toEqual([{ copyIndex: 4, content: 'c' }]);
  });
});
