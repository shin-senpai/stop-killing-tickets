/**
 * Runs jobs one at a time per key, in the order they were added. A failed job
 * does not stop the jobs after it; its error goes only to its own caller.
 */
export class KeyedSerialQueue<K> {
  private readonly tails = new Map<K, Promise<void>>();

  run<T>(key: K, job: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(job);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }

  get activeKeys(): number {
    return this.tails.size;
  }
}
