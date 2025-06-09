import { BaseScraper } from './base';
import { SearchResult, GenealogyResource, Env } from '../types';
import { ScraperError, ERROR_CODES } from '../utils/errors';
import { extractLinks, cleanText } from '../utils/htmlParser';

export async function searchResources(
  query: string,
  filters: any,
  env: Env
): Promise<SearchResult> {
  const scraper = new SearchScraper(env);
  return scraper.search(query, filters);
}

class SearchScraper extends BaseScraper {
  async search(query: string, _filters: any): Promise<SearchResult> {
    if (!query || query.trim().length === 0) {
      throw new ScraperError('Search query cannot be empty', ERROR_CODES.INVALID_INPUT, false);
    }
    
    await this.delay(1000); // Respectful delay
    
    try {
      // Construct search URL - Cyndi's List uses a simple search parameter
      const searchUrl = `${this.baseUrl}/search/?q=${encodeURIComponent(query.trim())}`;
      const response = await this.fetchPage(searchUrl);
      const html = await response.text();
      
      const resources = await this.parseSearchResults(html, query);
      
      return {
        resources,
        totalCount: resources.length,
        page: 1,
        pageSize: 20,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ScraperError(
          `Failed to search Cyndi's List: ${error.message}`,
          ERROR_CODES.NETWORK_ERROR
        );
      }
      throw error;
    }
  }
  
  private async parseSearchResults(html: string, query: string): Promise<GenealogyResource[]> {
    const resources: GenealogyResource[] = [];
    
    // Use the HTML parser utilities for better parsing
    const linkResources = this.parseLinksForResources(html, query);
    resources.push(...linkResources);
    
    // Parse list items that might contain resources
    const listResources = this.parseListContent(html, query);
    resources.push(...listResources);
    
    // Fallback to regex parsing for additional coverage
    const regexResources = this.parseWithRegex(html, query);
    resources.push(...regexResources);
    
    // Deduplicate and limit results
    const uniqueResources = this.deduplicateResources(resources);
    return uniqueResources.slice(0, 50); // Limit to 50 results
  }
  
  private parseLinksForResources(html: string, query: string): GenealogyResource[] {
    const resources: GenealogyResource[] = [];
    
    // Use the HTML parser utility to extract all links
    const links = extractLinks(html);
    
    for (const link of links) {
      if (this.isRelevantLink(link.href, link.text, query)) {
        const url = this.normalizeUrl(link.href);
        const title = cleanText(link.text);
        
        if (title.length > 3 && !resources.some(r => r.url === url)) {
          resources.push({
            id: this.generateId(url),
            title,
            url,
            description: link.title ? cleanText(link.title) : undefined,
            category: this.inferCategoryFromText(link.text + ' ' + (link.title || '')),
            resourceType: this.inferResourceType(title, link.title || ''),
            isFree: this.inferIsFree(title, link.title || ''),
            hasDigitalRecords: this.inferHasDigitalRecords(title, link.title || ''),
          });
        }
      }
    }
    
    return resources;
  }
  
  private parseListContent(html: string, query: string): GenealogyResource[] {
    const resources: GenealogyResource[] = [];
    
    // Look for list items that might contain resources
    const listItemRegex = /<li[^>]*>(.*?)<\/li>/gis;
    let match;
    
    while ((match = listItemRegex.exec(html)) !== null) {
      const itemContent = match[1];
      const linkMatch = itemContent.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      
      if (linkMatch) {
        const [, href, text] = linkMatch;
        if (this.isRelevantLink(href, text, query)) {
          const url = this.normalizeUrl(href);
          const title = this.cleanText(text);
          
          if (title.length > 3 && !resources.some(r => r.url === url)) {
            // Look for description in the same list item
            const descMatch = itemContent.match(/<\/a>\s*[-–—]\s*([^<]+)/i) ||
                             itemContent.match(/<br[^>]*>\s*([^<]+)/i);
            const description = descMatch ? this.cleanText(descMatch[1]) : '';
            
            resources.push({
              id: this.generateId(url),
              title,
              url,
              description,
              category: this.inferCategoryFromText(itemContent),
              resourceType: this.inferResourceType(title, description),
              isFree: this.inferIsFree(title, description),
              hasDigitalRecords: this.inferHasDigitalRecords(title, description),
            });
          }
        }
      }
    }
    
    return resources;
  }
  
  private parseWithRegex(html: string, query: string): GenealogyResource[] {
    const resources: GenealogyResource[] = [];
    
    // Look for common link patterns
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      
      if (this.isRelevantLink(href, text, query)) {
        const url = this.normalizeUrl(href);
        const title = this.cleanText(text);
        
        if (title.length > 3 && !resources.some(r => r.url === url)) {
          resources.push({
            id: this.generateId(url),
            title,
            url,
            category: 'general',
            resourceType: this.inferResourceType(title, ''),
            isFree: this.inferIsFree(title, ''),
            hasDigitalRecords: this.inferHasDigitalRecords(title, ''),
          });
        }
      }
    }
    
    return resources;
  }
  
  private isRelevantLink(href: string, text: string, query: string): boolean {
    if (!href || !text) return false;
    
    // Skip navigation, admin, and irrelevant links
    const skipPatterns = [
      '/search', '/contact', '/about', '/privacy', '/terms',
      'mailto:', 'tel:', '#', 'javascript:', 'http://www.cyndislist.com/search'
    ];
    
    if (skipPatterns.some(pattern => href.includes(pattern))) {
      return false;
    }
    
    // Check if text is relevant to genealogy or contains query terms
    const queryWords = query.toLowerCase().split(' ');
    const textLower = text.toLowerCase();
    
    return queryWords.some(word => textLower.includes(word)) ||
           this.isGenealogyRelated(text);
  }
  
  private isGenealogyRelated(text: string): boolean {
    const genealogyKeywords = [
      'records', 'genealogy', 'family', 'history', 'census', 'birth', 'death',
      'marriage', 'immigration', 'military', 'cemetery', 'obituary', 'ancestor'
    ];
    
    const textLower = text.toLowerCase();
    return genealogyKeywords.some(keyword => textLower.includes(keyword));
  }
  
  private inferCategoryFromText(content: string): string {
    const contentLower = content.toLowerCase();
    
    // Look for category keywords in the content
    if (contentLower.includes('census')) return 'census';
    if (contentLower.includes('birth') || contentLower.includes('baptism')) return 'births';
    if (contentLower.includes('death') || contentLower.includes('burial') || contentLower.includes('obituary')) return 'deaths';
    if (contentLower.includes('marriage') || contentLower.includes('divorce')) return 'marriages';
    if (contentLower.includes('military') || contentLower.includes('war')) return 'military';
    if (contentLower.includes('immigration') || contentLower.includes('passenger')) return 'immigration';
    if (contentLower.includes('newspaper')) return 'newspapers';
    if (contentLower.includes('cemetery') || contentLower.includes('grave')) return 'cemeteries';
    if (contentLower.includes('church') || contentLower.includes('parish')) return 'church';
    if (contentLower.includes('location') || contentLower.includes('country') || contentLower.includes('state')) return 'locations';
    
    return 'general';
  }
  
  private normalizeUrl(href: string): string {
    if (href.startsWith('http')) {
      return href;
    }
    if (href.startsWith('/')) {
      return `${this.baseUrl}${href}`;
    }
    return `${this.baseUrl}/${href}`;
  }
  
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
  
  private generateId(url: string): string {
    return this.hashString(url);
  }
  
  private inferResourceType(title: string, description: string): any {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('census')) return 'census';
    if (text.includes('birth') || text.includes('baptism')) return 'vital_records';
    if (text.includes('death') || text.includes('burial') || text.includes('obituary')) return 'vital_records';
    if (text.includes('marriage') || text.includes('divorce')) return 'vital_records';
    if (text.includes('military') || text.includes('war') || text.includes('veteran')) return 'military';
    if (text.includes('immigration') || text.includes('passenger') || text.includes('naturalization')) return 'immigration';
    if (text.includes('newspaper')) return 'newspapers';
    if (text.includes('cemetery') || text.includes('grave')) return 'cemeteries';
    if (text.includes('church') || text.includes('parish')) return 'church_records';
    
    return 'all';
  }
  
  private inferIsFree(title: string, description: string): boolean {
    const text = (title + ' ' + description).toLowerCase();
    return text.includes('free') || text.includes('no cost') || !text.includes('subscription');
  }
  
  private inferHasDigitalRecords(title: string, description: string): boolean {
    const text = (title + ' ' + description).toLowerCase();
    return text.includes('digital') || text.includes('online') || text.includes('database') || text.includes('searchable');
  }
  
  private deduplicateResources(resources: GenealogyResource[]): GenealogyResource[] {
    const seen = new Set<string>();
    return resources.filter(resource => {
      if (seen.has(resource.url)) {
        return false;
      }
      seen.add(resource.url);
      return true;
    });
  }
  
}