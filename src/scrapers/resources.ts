import { BaseScraper } from './base';
import { GenealogyResource, FilterCriteria, Env } from '../types';
import { ScraperError, ERROR_CODES } from '../utils/errors';
import { extractMetaContent, extractTextFromTag, extractElementsByTag, cleanText, extractYearRange, extractLocations } from '../utils/htmlParser';

export async function getResourceDetails(
  resourceId: string,
  includeRelated: boolean,
  env: Env
): Promise<GenealogyResource> {
  const scraper = new ResourceScraper(env);
  return scraper.getDetails(resourceId, includeRelated);
}

export async function filterResources(
  criteria: FilterCriteria,
  env: Env
): Promise<{ resources: GenealogyResource[]; totalCount: number }> {
  const scraper = new ResourceScraper(env);
  return scraper.filter(criteria);
}

export async function getLocationResources(
  country: string,
  env: Env,
  state?: string,
  county?: string,
  city?: string
): Promise<{ resources: GenealogyResource[]; totalCount: number }> {
  const scraper = new ResourceScraper(env);
  return scraper.getByLocation(country, state, county, city);
}

class ResourceScraper extends BaseScraper {
  async getDetails(
    resourceId: string,
    _includeRelated: boolean
  ): Promise<GenealogyResource> {
    if (!resourceId || resourceId.trim().length === 0) {
      throw new ScraperError('Resource ID cannot be empty', ERROR_CODES.INVALID_INPUT, false);
    }
    
    await this.delay(1000); // Respectful delay
    
    try {
      // Try to construct resource URL from ID
      let resourceUrl: string;
      if (resourceId.startsWith('http')) {
        resourceUrl = resourceId;
      } else {
        // Assume resourceId is a path or slug
        resourceUrl = `${this.baseUrl}/${resourceId}`;
      }
      
      const response = await this.fetchPage(resourceUrl);
      const html = await response.text();
      
      const resource = await this.parseResourceDetails(html, resourceUrl, resourceId);
      
      return resource;
    } catch (error) {
      if (error instanceof Error) {
        throw new ScraperError(
          `Failed to fetch resource details: ${error.message}`,
          ERROR_CODES.NETWORK_ERROR
        );
      }
      throw error;
    }
  }
  
  async filter(
    criteria: FilterCriteria
  ): Promise<{ resources: GenealogyResource[]; totalCount: number }> {
    await this.delay(1200); // Respectful delay
    
    try {
      // Build search URL based on criteria
      const searchParams = this.buildSearchParams(criteria);
      const searchUrl = `${this.baseUrl}/search/?${searchParams}`;
      
      const response = await this.fetchPage(searchUrl);
      const html = await response.text();
      
      const filteredResources = await this.parseFilteredResources(html, criteria);
      
      return {
        resources: filteredResources,
        totalCount: filteredResources.length,
      };
    } catch (error) {
      // Return empty results on error (fail-open approach)
      return {
        resources: [],
        totalCount: 0,
      };
    }
  }
  
  async getByLocation(
    country: string,
    state?: string,
    county?: string,
    city?: string
  ): Promise<{ resources: GenealogyResource[]; totalCount: number }> {
    if (!country || country.trim().length === 0) {
      throw new ScraperError('Country cannot be empty', ERROR_CODES.INVALID_INPUT, false);
    }
    
    await this.delay(1000); // Respectful delay
    
    try {
      // Build location-based URL
      const locationUrl = this.buildLocationUrl(country, state, county, city);
      const response = await this.fetchPage(locationUrl);
      const html = await response.text();
      
      const resources = await this.parseLocationResources(html, country, state, county, city);
      
      return {
        resources,
        totalCount: resources.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ScraperError(
          `Failed to fetch location resources: ${error.message}`,
          ERROR_CODES.NETWORK_ERROR
        );
      }
      throw error;
    }
  }
  
  private async parseResourceDetails(html: string, url: string, resourceId: string): Promise<GenealogyResource> {
    // Extract title using HTML parser utilities
    const title = extractTextFromTag(html, 'title') ||
                  extractTextFromTag(html, 'h1') ||
                  `Resource ${resourceId}`;
    
    // Extract description from meta tags or page content
    const description = extractMetaContent(html, 'description') ||
                       extractMetaContent(html, 'og:description') ||
                       this.extractFirstParagraph(html);
    
    // Extract category from URL or content
    const category = this.extractCategoryFromUrl(url) || this.extractCategoryFromContent(html);
    
    // Extract location information using HTML parser
    const extractedLocation = extractLocations(html);
    
    // Convert to LocationInfo type if we have at least a country
    const location = extractedLocation.country ? {
      country: extractedLocation.country,
      state: extractedLocation.state,
      county: extractedLocation.county,
      city: extractedLocation.city,
    } : undefined;
    
    // Extract time period using HTML parser
    const timeperiod = extractYearRange(html);
    
    // Determine resource type
    const resourceType = this.inferResourceType(title, description || '');
    
    // Check if free and has digital records
    const isFree = this.inferIsFree(title, description || '', html);
    const hasDigitalRecords = this.inferHasDigitalRecords(title, description || '', html);
    
    // Extract language
    const language = this.extractLanguage(html) || 'English';
    
    return {
      id: resourceId,
      title: cleanText(title),
      url,
      description: description ? cleanText(description) : undefined,
      category,
      location,
      timeperiod,
      resourceType,
      isFree,
      hasDigitalRecords,
      language,
      lastUpdated: new Date().toISOString(),
    };
  }
  
  private extractFirstParagraph(html: string): string | undefined {
    const paragraphs = extractElementsByTag(html, 'p');
    for (const p of paragraphs) {
      if (p.content.length > 50 && p.content.length < 500) {
        return p.content;
      }
    }
    return undefined;
  }
  
  private buildSearchParams(criteria: FilterCriteria): string {
    const params: string[] = [];
    
    if (criteria.categories?.length) {
      params.push(`category=${encodeURIComponent(criteria.categories.join(','))}`);
    }
    
    if (criteria.locations?.length) {
      params.push(`location=${encodeURIComponent(criteria.locations.join(','))}`);
    }
    
    if (criteria.languages?.length) {
      params.push(`language=${encodeURIComponent(criteria.languages.join(','))}`);
    }
    
    if (criteria.freeOnly) {
      params.push('free=true');
    }
    
    if (criteria.hasDigitalRecords) {
      params.push('digital=true');
    }
    
    return params.join('&');
  }
  
  private async parseFilteredResources(html: string, criteria: FilterCriteria): Promise<GenealogyResource[]> {
    const resources: GenealogyResource[] = [];
    
    // Parse links from search results
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      
      if (this.isResourceLink(href, text)) {
        const url = this.normalizeUrl(href);
        const title = this.cleanText(text);
        
        if (this.matchesCriteria(title, url, criteria)) {
          const resource: GenealogyResource = {
            id: this.generateId(url),
            title,
            url,
            category: this.extractCategoryFromUrl(url) || 'general',
            resourceType: this.inferResourceType(title, ''),
            isFree: criteria.freeOnly ? true : this.inferIsFree(title, '', ''),
            hasDigitalRecords: criteria.hasDigitalRecords ? true : this.inferHasDigitalRecords(title, '', ''),
          };
          
          resources.push(resource);
        }
      }
    }
    
    return resources.slice(0, 100); // Limit results
  }
  
  private buildLocationUrl(country: string, state?: string, county?: string, city?: string): string {
    // Build hierarchical location URL
    let path = `/locations/${encodeURIComponent(country.toLowerCase())}`;
    
    if (state) {
      path += `/${encodeURIComponent(state.toLowerCase())}`;
    }
    
    if (county) {
      path += `/${encodeURIComponent(county.toLowerCase())}`;
    }
    
    if (city) {
      path += `/${encodeURIComponent(city.toLowerCase())}`;
    }
    
    return `${this.baseUrl}${path}/`;
  }
  
  private async parseLocationResources(
    html: string,
    country: string,
    state?: string,
    county?: string,
    city?: string
  ): Promise<GenealogyResource[]> {
    const resources: GenealogyResource[] = [];
    
    // Parse location-specific resources
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      
      if (this.isResourceLink(href, text)) {
        const url = this.normalizeUrl(href);
        const title = this.cleanText(text);
        
        const resource: GenealogyResource = {
          id: this.generateId(url),
          title,
          url,
          category: 'locations',
          location: {
            country,
            state,
            county,
            city,
          },
          resourceType: this.inferResourceType(title, ''),
          isFree: this.inferIsFree(title, '', ''),
          hasDigitalRecords: this.inferHasDigitalRecords(title, '', ''),
        };
        
        resources.push(resource);
      }
    }
    
    return resources.slice(0, 50); // Limit results
  }
  
  private extractCategoryFromUrl(url: string): string {
    const categoryMatch = url.match(/\/([^\/]+)\//);
    if (categoryMatch) {
      const category = categoryMatch[1].toLowerCase();
      if (['births', 'deaths', 'marriages', 'census', 'military', 'immigration', 'newspapers', 'cemeteries'].includes(category)) {
        return category;
      }
    }
    return 'general';
  }
  
  private extractCategoryFromContent(html: string): string {
    const categoryKeywords = [
      { keywords: ['census', 'enumeration'], category: 'census' },
      { keywords: ['birth', 'baptism'], category: 'births' },
      { keywords: ['death', 'burial', 'obituary'], category: 'deaths' },
      { keywords: ['marriage', 'wedding', 'divorce'], category: 'marriages' },
      { keywords: ['military', 'war', 'veteran'], category: 'military' },
      { keywords: ['immigration', 'passenger', 'naturalization'], category: 'immigration' },
      { keywords: ['newspaper', 'news'], category: 'newspapers' },
      { keywords: ['cemetery', 'grave', 'memorial'], category: 'cemeteries' },
    ];
    
    const htmlLower = html.toLowerCase();
    for (const { keywords, category } of categoryKeywords) {
      if (keywords.some(keyword => htmlLower.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }
  
  
  private extractLanguage(html: string): string | undefined {
    const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i) ||
                     html.match(/language[:\s]+([^,\n<]+)/i);
    
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.startsWith('en')) return 'English';
      if (lang.startsWith('es')) return 'Spanish';
      if (lang.startsWith('fr')) return 'French';
      if (lang.startsWith('de')) return 'German';
      if (lang.startsWith('it')) return 'Italian';
      return langMatch[1];
    }
    
    return undefined;
  }
  
  private isResourceLink(href: string, text: string): boolean {
    if (!href || !text) return false;
    
    const skipPatterns = [
      'mailto:', 'tel:', '#', 'javascript:', '/search', '/contact',
      '/about', '/privacy', '/terms', '.jpg', '.png', '.gif', '.pdf'
    ];
    
    return !skipPatterns.some(pattern => href.toLowerCase().includes(pattern)) &&
           text.length > 3;
  }
  
  private matchesCriteria(title: string, url: string, criteria: FilterCriteria): boolean {
    const titleLower = title.toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Check categories
    if (criteria.categories?.length) {
      const hasMatchingCategory = criteria.categories.some(cat =>
        titleLower.includes(cat.toLowerCase()) || urlLower.includes(cat.toLowerCase())
      );
      if (!hasMatchingCategory) return false;
    }
    
    // Check locations
    if (criteria.locations?.length) {
      const hasMatchingLocation = criteria.locations.some(loc =>
        titleLower.includes(loc.toLowerCase()) || urlLower.includes(loc.toLowerCase())
      );
      if (!hasMatchingLocation) return false;
    }
    
    // Check free only
    if (criteria.freeOnly && !this.inferIsFree(title, '', '')) {
      return false;
    }
    
    return true;
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
  
  private inferIsFree(title: string, description: string, content: string): boolean {
    const text = (title + ' ' + description + ' ' + content).toLowerCase();
    
    if (text.includes('free') || text.includes('no cost') || text.includes('no charge')) return true;
    if (text.includes('subscription') || text.includes('paid') || text.includes('premium')) return false;
    
    return true; // Default to free
  }
  
  private inferHasDigitalRecords(title: string, description: string, content: string): boolean {
    const text = (title + ' ' + description + ' ' + content).toLowerCase();
    return text.includes('digital') || text.includes('online') ||
           text.includes('database') || text.includes('searchable') ||
           text.includes('electronic') || text.includes('scanned');
  }
  
}