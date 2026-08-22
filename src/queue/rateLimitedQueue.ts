/**
 * Per-provider concurrency + requests-per-minute limiter. Deliberately generic
 * (no provider-specific logic) so the same primitive works for any AIProvider and
 * can be reused for future non-AI async work without touching business logic.
 */
export class RateLimitedQueue {
  private active = 0;
  private waiters: Array<() => void> = [];
  private windowStarts: number[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly requestsPerMinute: number,
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireConcurrencySlot();
    try {
      await this.acquireRateLimitSlot();
      return await task();
    } finally {
      this.release();
    }
  }

  private acquireConcurrencySlot(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private async acquireRateLimitSlot(): Promise<void> {
    if (this.requestsPerMinute <= 0) return; // 0/unset = unlimited
    for (;;) {
      const now = Date.now();
      this.windowStarts = this.windowStarts.filter((t) => now - t < 60_000);
      if (this.windowStarts.length < this.requestsPerMinute) {
        this.windowStarts.push(now);
        return;
      }
      const oldest = this.windowStarts[0] as number;
      const waitMs = 60_000 - (now - oldest) + 5;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
