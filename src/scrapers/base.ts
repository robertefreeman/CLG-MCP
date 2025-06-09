import { Env, CacheEntry } from '../types';

export abstract class BaseScraper {
  protected readonly baseUrl = 'https://www.cyndislist.com';
  protected readonly userAgent = 'CLG-MCP/1.0 (Genealogy Research Tool)';

  constructor(protected env: Env) {}

  protected async fetchWithCache<T>(
    cacheKey: string,
    ttl: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Check if caching is enabled
    if (this.env.CACHE_ENABLED !== 'true') {
      return fetcher();
    }

    try {
      // Try to get from cache
      const cached = await this.env.CACHE.get(cacheKey);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - entry.timestamp < entry.ttl * 1000) {
          return entry.data;
        }
      }
    } catch (error) {
      // Log error but continue with fetching
      console.error('Cache read error:', error);
    }

    // Fetch new data
    const data = await fetcher();

    // Store in cache
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      
      await this.env.CACHE.put(cacheKey, JSON.stringify(entry), {
        expirationTtl: ttl,
      });
    } catch (error) {
      // Log error but return data anyway
      console.error('Cache write error:', error);
    }

    return data;
  }

  protected async fetchPage(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}