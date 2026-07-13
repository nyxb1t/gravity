/**
 * @file integrations/notion/client.ts
 * @description Live Notion integration — fetches pages from a configured database.
 *
 * Env vars required:
 *   NOTION_TOKEN       – Integration secret (ntn_… or secret_…)
 *   NOTION_DATABASE_ID – Target database UUID
 */

import { Client } from '@notionhq/client';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateNotionEnv(): boolean {
  const missing: string[] = [];
  if (!process.env.NOTION_TOKEN)       missing.push('NOTION_TOKEN');
  if (!process.env.NOTION_DATABASE_ID) missing.push('NOTION_DATABASE_ID');

  if (missing.length > 0) {
    console.error(`[Notion] ❌ Missing env vars: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public fetcher
// ---------------------------------------------------------------------------

export async function fetchNotionData(): Promise<WorkspaceItem[]> {
  if (!validateNotionEnv()) {
    console.warn('[Notion] ⚠️  Skipping — missing credentials. Returning empty.');
    return [];
  }

  const databaseId = process.env.NOTION_DATABASE_ID!;
  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  console.log(`[Notion] 🔄 Querying database ${databaseId}…`);

  let results: any[] = [];

  try {
    // First attempt: try with Status filter (requires "Status" property of type "status")
    try {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Status',
          status: {
            does_not_equal: 'Done',
          },
        },
        page_size: 50,
      });
      results = response.results;
      console.log('[Notion] ✅ Connected — database reachable');
      console.log(`[Notion] 📝 Fetched ${results.length} pages (with Status filter)`);
    } catch (filterErr: any) {
      // If Status filter fails (property doesn't exist or wrong type), fetch all pages
      console.warn('[Notion] ⚠️  Status filter failed — fetching all pages without filter');
      const response = await notion.databases.query({
        database_id: databaseId,
        page_size: 50,
      });
      results = response.results;
      console.log('[Notion] ✅ Connected — database reachable');
      console.log(`[Notion] 📝 Fetched ${results.length} pages (no filter)`);
    }
  } catch (err: any) {
    const msg = err?.message ?? String(err);

    if (err?.code === 'object_not_found' || err?.status === 404) {
      console.error(`[Notion] ❌ Database not found — "${databaseId}" does not exist or is not shared with this integration`);
      console.error('[Notion] ℹ️  Go to Notion → open the database → "..." menu → Add connections → select your integration');
    } else if (err?.code === 'unauthorized' || err?.status === 401) {
      console.error('[Notion] ❌ NOTION_TOKEN is invalid — check the integration secret');
    } else if (err?.code === 'restricted_resource' || err?.status === 403) {
      console.error('[Notion] ❌ Database access denied — share the database with the integration in Notion');
    } else {
      console.error('[Notion] ❌ Failed to fetch:', msg);
    }
    return [];
  }

  return results.map(GravityNormalizer.fromNotion);
}