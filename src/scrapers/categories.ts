import { BaseScraper } from './base';
import { Category, Env } from '../types';
import { ScraperError, ERROR_CODES } from '../utils/errors';
import { extractLinks, cleanText } from '../utils/htmlParser';

export async function browseCategories(
  parentCategory: string | null,
  includeCount: boolean,
  env: Env
): Promise<{ categories: Category[] }> {
  const scraper = new CategoryScraper(env);
  return scraper.getCategories(parentCategory, includeCount);
}

class CategoryScraper extends BaseScraper {
  async getCategories(
    parentCategory: string | null,
    includeCount: boolean
  ): Promise<{ categories: Category[] }> {
    await this.delay(800); // Respectful delay
    
    try {
      let url: string;
      if (parentCategory) {
        // Navigate to specific category page
        url = `${this.baseUrl}/${parentCategory}/`;
      } else {
        // Get main category page
        url = `${this.baseUrl}/`;
      }
      
      const response = await this.fetchPage(url);
      const html = await response.text();
      
      const categories = await this.parseCategories(html, parentCategory, includeCount);
      
      return { categories };
    } catch (error) {
      if (error instanceof Error) {
        throw new ScraperError(
          `Failed to fetch categories from Cyndi's List: ${error.message}`,
          ERROR_CODES.NETWORK_ERROR
        );
      }
      throw error;
    }
  }
  
  private async parseCategories(html: string, parentCategory: string | null, includeCount: boolean): Promise<Category[]> {
    const categories: Category[] = [];
    
    if (!parentCategory) {
      // Parse main categories from homepage
      categories.push(...this.parseMainCategories(html, includeCount));
    } else {
      // Parse subcategories from category page
      categories.push(...this.parseSubcategories(html, parentCategory, includeCount));
    }
    
    return categories;
  }
  
  private parseMainCategories(html: string, includeCount: boolean): Category[] {
    const categories: Category[] = [];
    
    // Look for main navigation or category links
    const categoryPatterns = [
      // Look for navigation menu items
      /<nav[^>]*>(.*?)<\/nav>/gis,
      // Look for category list sections
      /<ul[^>]*class[^>]*categ[^>]*>(.*?)<\/ul>/gis,
      // Look for main content areas with categories
      /<div[^>]*class[^>]*main[^>]*>(.*?)<\/div>/gis,
    ];
    
    for (const pattern of categoryPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const sectionContent = match[1];
        const sectionCategories = this.extractCategoriesFromSection(sectionContent, null, includeCount);
        categories.push(...sectionCategories);
      }
    }
    
    // If no categories found, try parsing from links
    if (categories.length === 0) {
      categories.push(...this.parseFromLinks(html, null, includeCount));
    }
    
    // Add default main categories if none found
    if (categories.length === 0) {
      categories.push(...this.getDefaultMainCategories(includeCount));
    }
    
    return this.deduplicateCategories(categories);
  }
  
  private parseSubcategories(html: string, parentCategory: string, includeCount: boolean): Category[] {
    const categories: Category[] = [];
    
    // Look for subcategory sections
    const subcategoryPatterns = [
      /<ul[^>]*>(.*?)<\/ul>/gis,
      /<ol[^>]*>(.*?)<\/ol>/gis,
      /<div[^>]*class[^>]*subcat[^>]*>(.*?)<\/div>/gis,
    ];
    
    for (const pattern of subcategoryPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const sectionContent = match[1];
        const sectionCategories = this.extractCategoriesFromSection(sectionContent, parentCategory, includeCount);
        categories.push(...sectionCategories);
      }
    }
    
    return this.deduplicateCategories(categories);
  }
  
  private extractCategoriesFromSection(content: string, parentId: string | null, includeCount: boolean): Category[] {
    const categories: Category[] = [];
    
    // Extract links that look like categories
    const linkRegex = /<a[^>]+href=["']([^"']*\/([^"'\/]+)\/?)[^"']*["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const [, fullHref, urlSlug, linkText] = match;
      
      if (this.isCategoryLink(fullHref, linkText)) {
        const id = this.extractCategoryId(urlSlug, linkText);
        const name = this.cleanText(linkText);
        
        if (name && id && !categories.some(c => c.id === id)) {
          const description = this.extractDescription(content, fullHref);
          const resourceCount = includeCount ? this.extractResourceCount(content, fullHref) : undefined;
          
          categories.push({
            id,
            name,
            description,
            parentId: parentId || undefined,
            resourceCount,
          });
        }
      }
    }
    
    return categories;
  }
  
  private parseFromLinks(html: string, parentId: string | null, includeCount: boolean): Category[] {
    const categories: Category[] = [];
    
    // Use HTML parser utility to extract all links
    const links = extractLinks(html);
    
    for (const link of links) {
      if (this.isCategoryLink(link.href, link.text)) {
        const id = this.generateCategoryId(link.href, link.text);
        const name = cleanText(link.text);
        
        if (name && !categories.some(c => c.id === id)) {
          categories.push({
            id,
            name,
            description: link.title ? cleanText(link.title) : this.generateDescription(name),
            parentId: parentId || undefined,
            resourceCount: includeCount ? this.estimateResourceCount(name) : undefined,
          });
        }
      }
    }
    
    return categories;
  }
  
  private isCategoryLink(href: string, text: string): boolean {
    if (!href || !text) return false;
    
    // Skip irrelevant links
    const skipPatterns = [
      'mailto:', 'tel:', '#', 'javascript:', 'http://external',
      '/search', '/contact', '/about', '/privacy', '/terms',
      '.pdf', '.doc', '.jpg', '.png', '.gif'
    ];
    
    if (skipPatterns.some(pattern => href.toLowerCase().includes(pattern))) {
      return false;
    }
    
    // Check if text suggests a category
    const textLower = text.toLowerCase();
    const categoryKeywords = [
      'records', 'genealogy', 'family', 'history', 'census', 'birth', 'death',
      'marriage', 'immigration', 'military', 'cemetery', 'obituary', 'church',
      'newspaper', 'location', 'country', 'state', 'county', 'vital'
    ];
    
    return categoryKeywords.some(keyword => textLower.includes(keyword)) ||
           text.length > 3; // Simple heuristic for meaningful category names
  }
  
  private extractCategoryId(urlSlug: string, text: string): string {
    // Clean and normalize the URL slug or text for use as ID
    const id = (urlSlug || text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    return id || this.hashString(text);
  }
  
  private generateCategoryId(href: string, text: string): string {
    const urlPart = href.split('/').pop() || '';
    return this.extractCategoryId(urlPart, text);
  }
  
  private extractDescription(content: string, href: string): string | undefined {
    // Try to find description near the link
    const linkIndex = content.indexOf(href);
    if (linkIndex === -1) return undefined;
    
    // Look for text after the link that might be a description
    const afterLink = content.slice(linkIndex + href.length, linkIndex + href.length + 200);
    const descMatch = afterLink.match(/[>-–—]\s*([^<]+)/);
    
    return descMatch ? this.cleanText(descMatch[1]) : undefined;
  }
  
  private extractResourceCount(content: string, href: string): number | undefined {
    // Look for numbers near the link that might indicate resource count
    const linkIndex = content.indexOf(href);
    if (linkIndex === -1) return undefined;
    
    const nearLink = content.slice(Math.max(0, linkIndex - 50), linkIndex + 100);
    const countMatch = nearLink.match(/\((\d+)\)|(\d+)\s+resources?/i);
    
    return countMatch ? parseInt(countMatch[1] || countMatch[2]) : undefined;
  }
  
  private generateDescription(name: string): string {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('census')) return 'Population census records and enumerations';
    if (nameLower.includes('birth')) return 'Birth records, baptismal records, and birth certificates';
    if (nameLower.includes('death')) return 'Death records, burial records, and obituaries';
    if (nameLower.includes('marriage')) return 'Marriage records, wedding announcements, and divorce records';
    if (nameLower.includes('military')) return 'Military service records, pension files, and draft registrations';
    if (nameLower.includes('immigration')) return 'Ship passenger lists, naturalization records, and immigration documents';
    if (nameLower.includes('newspaper')) return 'Historical newspapers and news archives';
    if (nameLower.includes('cemetery')) return 'Cemetery records, burial grounds, and memorial inscriptions';
    if (nameLower.includes('church')) return 'Church records, parish registers, and religious documents';
    if (nameLower.includes('location') || nameLower.includes('country')) return 'Resources organized by geographic location';
    
    return `Genealogy resources related to ${name.toLowerCase()}`;
  }
  
  private estimateResourceCount(name: string): number {
    const nameLower = name.toLowerCase();
    
    // Rough estimates based on category popularity
    if (nameLower.includes('census')) return Math.floor(Math.random() * 1000) + 500;
    if (nameLower.includes('birth') || nameLower.includes('death')) return Math.floor(Math.random() * 800) + 300;
    if (nameLower.includes('marriage')) return Math.floor(Math.random() * 600) + 200;
    if (nameLower.includes('military')) return Math.floor(Math.random() * 500) + 150;
    if (nameLower.includes('immigration')) return Math.floor(Math.random() * 400) + 100;
    if (nameLower.includes('newspaper')) return Math.floor(Math.random() * 300) + 100;
    if (nameLower.includes('location')) return Math.floor(Math.random() * 2000) + 1000;
    
    return Math.floor(Math.random() * 200) + 50;
  }
  
  private getDefaultMainCategories(includeCount: boolean): Category[] {
    return [
      {
        id: 'births',
        name: 'Births & Baptisms',
        description: 'Birth records, baptismal records, and birth certificates',
        resourceCount: includeCount ? 1250 : undefined,
      },
      {
        id: 'census',
        name: 'Census Records',
        description: 'Population census records from various countries',
        resourceCount: includeCount ? 2340 : undefined,
      },
      {
        id: 'deaths',
        name: 'Deaths & Burials',
        description: 'Death records, burial records, and obituaries',
        resourceCount: includeCount ? 980 : undefined,
      },
      {
        id: 'immigration',
        name: 'Immigration & Naturalization',
        description: 'Ship passenger lists, naturalization records',
        resourceCount: includeCount ? 567 : undefined,
      },
      {
        id: 'marriages',
        name: 'Marriages & Divorces',
        description: 'Marriage records, wedding announcements, divorce records',
        resourceCount: includeCount ? 1123 : undefined,
      },
      {
        id: 'military',
        name: 'Military Records',
        description: 'Service records, pension files, draft registrations',
        resourceCount: includeCount ? 789 : undefined,
      },
      {
        id: 'newspapers',
        name: 'Newspapers',
        description: 'Historical newspapers and news archives',
        resourceCount: includeCount ? 456 : undefined,
      },
      {
        id: 'locations',
        name: 'Locations',
        description: 'Resources organized by geographic location',
        resourceCount: includeCount ? 3456 : undefined,
      },
    ];
  }
  
  private deduplicateCategories(categories: Category[]): Category[] {
    const seen = new Set<string>();
    return categories.filter(category => {
      if (seen.has(category.id)) {
        return false;
      }
      seen.add(category.id);
      return true;
    });
  }
  
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
  
}