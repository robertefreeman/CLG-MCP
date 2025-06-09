import { searchResources } from '../scrapers/search';
import { browseCategories } from '../scrapers/categories';
import { getResourceDetails, filterResources, getLocationResources } from '../scrapers/resources';
import { Env } from '../types';

export async function handleSearchResources(args: any, env: Env): Promise<any> {
  return await searchResources(args.query, args, env);
}

export async function handleBrowseCategories(args: any, env: Env): Promise<any> {
  return await browseCategories(args.parentCategory, args.includeCount || false, env);
}

export async function handleGetResourceDetails(args: any, env: Env): Promise<any> {
  return await getResourceDetails(args.resourceId, args.includeRelated || false, env);
}

export async function handleFilterResources(args: any, env: Env): Promise<any> {
  return await filterResources(args, env);
}

export async function handleGetLocationResources(args: any, env: Env): Promise<any> {
  return await getLocationResources(
    args.country,
    env,
    args.state,
    args.county,
    args.city
  );
}