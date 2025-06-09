import { Env } from '../types';

export abstract class BaseScraper {
  protected readonly baseUrl = 'https://www.cyndislist.com';
  protected readonly userAgent = 'CLG-MCP/1.0 (Genealogy Research Tool)';

  constructor(protected env: Env) {}

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

  protected hashString(str: string): string {
    // Simple hash function for generating IDs
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}