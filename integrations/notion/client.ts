
import { Client } from '@notionhq/client';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function fetchNotionData(): Promise<WorkspaceItem[]> {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error('NOTION_DATABASE_ID must be set in .env');

  const response = await notion.databases.query({
    database_id: databaseId,
    // Only fetch active tasks — exclude done/archived
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Done'
      }
    },
    page_size: 50
  });

  return response.results.map(GravityNormalizer.fromNotion);
}