export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { WorkspaceItem } from '@/types';

/**
 * GET /api/gravity/context
 *
 * Fetches live workspace data from all integrations and returns it as JSON.
 * Useful for debugging — hit this endpoint to verify integrations are working
 * before testing through Slack.
 *
 * Example: curl http://localhost:3000/api/gravity/context
 */
export async function GET() {
  const useLive = process.env.USE_LIVE_DATA === 'true';

  console.log('[API/context] Request received');
  console.log('[API/context] USE_LIVE_DATA =', useLive);
  console.log('[API/context] GitHub  =', !!(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO));
  console.log('[API/context] Calendar=', !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN));
  console.log('[API/context] Notion  =', !!(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID));
  console.log('[API/context] Gemini  =', !!process.env.GEMINI_API_KEY);

  let githubItems:   WorkspaceItem[] = [];
  let calendarItems: WorkspaceItem[] = [];
  let notionItems:   WorkspaceItem[] = [];
  const errors: Record<string, string> = {};

  try {
    const { fetchGitHubData } = await import('@/integrations/github/client');
    githubItems = await fetchGitHubData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/context] GitHub error:', msg);
    errors.github = msg;
  }

  try {
    const { fetchCalendarData } = await import('@/integrations/calendar/client');
    calendarItems = await fetchCalendarData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/context] Calendar error:', msg);
    errors.calendar = msg;
  }

  try {
    const { fetchNotionData } = await import('@/integrations/notion/client');
    notionItems = await fetchNotionData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/context] Notion error:', msg);
    errors.notion = msg;
  }

  const allItems = [...githubItems, ...calendarItems, ...notionItems];

  console.log(`[API/context] ✅ Returning ${allItems.length} items (GitHub: ${githubItems.length}, Calendar: ${calendarItems.length}, Notion: ${notionItems.length})`);

  return NextResponse.json(
    {
      timestamp:   new Date().toISOString(),
      useLive,
      summary: {
        total:    allItems.length,
        github:   githubItems.length,
        calendar: calendarItems.length,
        notion:   notionItems.length,
      },
      errors:    Object.keys(errors).length > 0 ? errors : undefined,
      items:     allItems,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}