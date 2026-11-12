import { describe, expect, it } from 'vitest';
import { KeyedSerialQueue } from './serialQueue.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('KeyedSerialQueue', () => {
  it('runs jobs for one key in order', async () => {
    const queue = new KeyedSerialQueue<number>();
    const order: string[] = [];
    await Promise.all([
      queue.run(1, async () => {
        await delay(20);
        order.push('a');
      }),
      queue.run(1, async () => order.push('b')),
      queue.run(1, async () => {
        await delay(5);
        order.push('c');
      }),
    ]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('runs jobs for different keys in parallel', async () => {
    const queue = new KeyedSerialQueue<number>();
    const order: string[] = [];
    await Promise.all([
      queue.run(1, async () => {
        await delay(20);
        order.push('slow');
      }),
      queue.run(2, async () => order.push('fast')),
    ]);
    expect(order).toEqual(['fast', 'slow']);
  });

  it('returns each job result to its caller', async () => {
    const queue = new KeyedSerialQueue<string>();
    await expect(queue.run('k', async () => 42)).resolves.toBe(42);
  });

  it('keeps going after a job fails', async () => {
    const queue = new KeyedSerialQueue<number>();
    const failing = queue.run(1, async () => {
      throw new Error('boom');
    });
    const next = queue.run(1, async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('forgets keys once their jobs are done', async () => {
    const queue = new KeyedSerialQueue<number>();
    await queue.run(1, async () => undefined);
    await delay(0);
    expect(queue.activeKeys).toBe(0);
  });
});
