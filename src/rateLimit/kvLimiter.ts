import { Env, RateLimitResult } from '../types';

export class KVRateLimiter {
  private readonly requestsPerMinute = 30;
  private readonly ttl = 120; // 2 minutes

  constructor(private env: Env) {}

  async checkLimit(clientIp: string): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60000);
    const key = this.getRateLimitKey(clientIp, minute);

    try {
      const count = await this.env.CACHE.get(key);
      
      if (count && parseInt(count) >= this.requestsPerMinute) {
        return false;
      }

      // Increment counter
      const newCount = (parseInt(count || '0') + 1).toString();
      await this.env.CACHE.put(key, newCount, {
        expirationTtl: this.ttl,
      });

      return true;
    } catch (error) {
      // On error, allow request (fail open)
      console.error('Rate limit check failed:', error);
      return true;
    }
  }

  async getRateLimitInfo(clientIp: string): Promise<RateLimitResult> {
    const minute = Math.floor(Date.now() / 60000);
    const key = this.getRateLimitKey(clientIp, minute);

    try {
      const count = await this.env.CACHE.get(key);
      const currentCount = parseInt(count || '0');
      
      return {
        allowed: currentCount < this.requestsPerMinute,
        remaining: Math.max(0, this.requestsPerMinute - currentCount),
        resetAt: (minute + 1) * 60000,
      };
    } catch (error) {
      return {
        allowed: true,
        remaining: this.requestsPerMinute,
        resetAt: (minute + 1) * 60000,
      };
    }
  }

  private getRateLimitKey(ip: string, minute: number): string {
    return `rl:${ip}:${minute}`;
  }
}