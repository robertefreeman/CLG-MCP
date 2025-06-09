/**
 * HTML parsing utilities for web scraping
 * These functions provide safe HTML parsing without relying on DOM APIs
 */

export interface ParsedLink {
  href: string;
  text: string;
  title?: string;
}

export interface ParsedElement {
  tag: string;
  attributes: Record<string, string>;
  content: string;
  innerHTML: string;
}

/**
 * Extract all links from HTML content
 */
export function extractLinks(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const linkRegex = /<a([^>]*)>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const attributes = match[1];
    const text = cleanText(match[2]);
    
    const hrefMatch = attributes.match(/href=["']([^"']+)["']/i);
    const titleMatch = attributes.match(/title=["']([^"']+)["']/i);
    
    if (hrefMatch && text) {
      links.push({
        href: hrefMatch[1],
        text,
        title: titleMatch ? titleMatch[1] : undefined,
      });
    }
  }
  
  return links;
}

/**
 * Extract elements by tag name
 */
export function extractElementsByTag(html: string, tagName: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const regex = new RegExp(`<${tagName}([^>]*)>(.*?)<\/${tagName}>`, 'gis');
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const attributesStr = match[1];
    const innerHTML = match[2];
    const content = cleanText(innerHTML);
    
    const attributes = parseAttributes(attributesStr);
    
    elements.push({
      tag: tagName,
      attributes,
      content,
      innerHTML,
    });
  }
  
  return elements;
}

/**
 * Extract elements by class name
 */
export function extractElementsByClass(html: string, className: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const regex = new RegExp(`<([^>]+)class[^>]*=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>(.*?)<\/\\1>`, 'gis');
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const tagMatch = match[1].match(/^(\w+)/);
    if (!tagMatch) continue;
    
    const tag = tagMatch[1];
    const fullTag = match[1];
    const innerHTML = match[2];
    const content = cleanText(innerHTML);
    
    const attributes = parseAttributes(fullTag);
    
    elements.push({
      tag,
      attributes,
      content,
      innerHTML,
    });
  }
  
  return elements;
}

/**
 * Extract meta tag content
 */
export function extractMetaContent(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

/**
 * Extract text from specific HTML tags
 */
export function extractTextFromTag(html: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i');
  const match = html.match(regex);
  return match ? cleanText(match[1]) : undefined;
}

/**
 * Extract list items with their content
 */
export function extractListItems(html: string): ParsedElement[] {
  return extractElementsByTag(html, 'li');
}

/**
 * Extract table data
 */
export function extractTableData(html: string): string[][] {
  const tables: string[][] = [];
  const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1];
      const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        cells.push(cleanText(cellMatch[1]));
      }
      
      if (cells.length > 0) {
        tables.push(cells);
      }
    }
  }
  
  return tables;
}

/**
 * Parse HTML attributes from attribute string
 */
function parseAttributes(attributesStr: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=["']([^"']+)["']/g;
  let match;
  
  while ((match = attrRegex.exec(attributesStr)) !== null) {
    attributes[match[1]] = match[2];
  }
  
  return attributes;
}

/**
 * Clean and normalize text content
 */
export function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code))) // Decode numeric entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract year ranges from text
 */
export function extractYearRange(text: string): { start?: number; end?: number } | undefined {
  // Look for year ranges like "1850-1950" or "1850–1950"
  const rangeMatch = text.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (rangeMatch) {
    return {
      start: parseInt(rangeMatch[1]),
      end: parseInt(rangeMatch[2]),
    };
  }
  
  // Look for single years
  const yearMatch = text.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1600 && year <= new Date().getFullYear()) {
      return { start: year };
    }
  }
  
  return undefined;
}

/**
 * Extract geographic locations from text
 */
export function extractLocations(text: string): {
  country?: string;
  state?: string;
  county?: string;
  city?: string;
} {
  const location: any = {};
  
  // Common location patterns
  const patterns = [
    { regex: /(?:country|nation)[:\s]+([^,\n.]+)/i, type: 'country' },
    { regex: /(?:state|province)[:\s]+([^,\n.]+)/i, type: 'state' },
    { regex: /(?:county|parish)[:\s]+([^,\n.]+)/i, type: 'county' },
    { regex: /(?:city|town|village)[:\s]+([^,\n.]+)/i, type: 'city' },
  ];
  
  for (const { regex, type } of patterns) {
    const match = text.match(regex);
    if (match) {
      location[type] = cleanText(match[1]);
    }
  }
  
  return location;
}

/**
 * Check if text contains genealogy-related keywords
 */
export function isGenealogyRelated(text: string): boolean {
  const keywords = [
    'genealogy', 'family', 'history', 'ancestry', 'heritage',
    'records', 'census', 'birth', 'death', 'marriage', 'divorce',
    'immigration', 'military', 'cemetery', 'obituary', 'church',
    'parish', 'vital', 'naturalization', 'passenger', 'ancestor',
    'descendant', 'lineage', 'pedigree', 'bloodline'
  ];
  
  const textLower = text.toLowerCase();
  return keywords.some(keyword => textLower.includes(keyword));
}