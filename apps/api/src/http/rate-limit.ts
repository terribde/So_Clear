export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private lastSweep = 0;

  constructor(private readonly options: RateLimitOptions) {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new Error('Rate limit must be a positive integer.');
    }
    if (!Number.isFinite(options.windowMs) || options.windowMs < 1) {
      throw new Error('Rate limit window must be a positive number.');
    }
  }

  consume(key: string, now = Date.now()): RateLimitDecision {
    this.sweep(now);
    const current = this.windows.get(key);

    if (!current || now >= current.resetAt) {
      const next = { count: 1, resetAt: now + this.options.windowMs };
      this.windows.set(key, next);
      return {
        allowed: true,
        limit: this.options.limit,
        remaining: this.options.limit - 1,
        resetAt: next.resetAt,
      };
    }

    if (current.count >= this.options.limit) {
      return { allowed: false, limit: this.options.limit, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return {
      allowed: true,
      limit: this.options.limit,
      remaining: this.options.limit - current.count,
      resetAt: current.resetAt,
    };
  }

  private sweep(now: number) {
    if (now - this.lastSweep < this.options.windowMs) return;
    this.lastSweep = now;
    for (const [key, state] of this.windows) {
      if (now >= state.resetAt) this.windows.delete(key);
    }
  }
}
