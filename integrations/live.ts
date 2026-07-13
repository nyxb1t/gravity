/**
 * @file integrations/live.ts
 * @description Single source of truth for live workspace data.
 *
 * When USE_LIVE_DATA=true  → fetches from GitHub + Google Calendar + Notion
 * When USE_LIVE_DATA=false → returns mock data (development only)
 *
 * IMPORTANT: When live mode is active, this module NEVER silently falls back
 * to mock data. Integration failures return empty arrays with proper logs.
 */

import type { NormalizedItem, UserContext, WorkspaceItem } from '@/types';

// ---------------------------------------------------------------------------
// Config startup log
// ---------------------------------------------------------------------------

export function logStartupConfig(): void {
  const useLive = process.env.USE_LIVE_DATA === 'true';
  console.log('[Gravity Config]');
  console.log(`  USE_LIVE_DATA = ${useLive}`);
  console.log(`  GitHub        = ${!!(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)}`);
  console.log(`  Calendar      = ${!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN)}`);
  console.log(`  Notion        = ${!!(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID)}`);
  console.log(`  Gemini        = ${!!process.env.GEMINI_API_KEY}`);
  console.log(`  Slack         = ${!!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET)}`);
}

// ---------------------------------------------------------------------------
// WorkspaceItem → NormalizedItem converter
// ---------------------------------------------------------------------------

function toNormalizedItem(raw: WorkspaceItem): NormalizedItem {
  return {
    raw,
    conflicts:        [],
    isRead:           false,
    isBookmarked:     false,
    firstSeenAt:      null,
    lastProcessedAt:  new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Live user context (built from env, not mock)
// ---------------------------------------------------------------------------

function buildLiveUserContext(): UserContext {
  return {
    userId:      process.env.GITHUB_OWNER ?? 'user',
    displayName: process.env.GITHUB_OWNER ?? 'User',
    email:       '',
    locale:      'en',
    timezone:    'Asia/Kolkata',
    connectedAccounts: {
      github:   process.env.GITHUB_OWNER ?? '',
      notion:   process.env.NOTION_DATABASE_ID ?? '',
      calendar: '',
    },
    roles:   ['engineering'],
    quietHours: { start: '23:00', end: '08:00' },
    prioritySources: [
      `github:${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`,
    ],
    mutedSources: [],
  };
}

// ---------------------------------------------------------------------------
// Public data contract
// ---------------------------------------------------------------------------

export interface WorkspaceData {
  items:       NormalizedItem[];
  userContext: UserContext;
  sources: {
    github:   number;
    calendar: number;
    notion:   number;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches workspace data from all live integrations.
 *
 * NEVER falls back to mock when USE_LIVE_DATA=true.
 * Returns proper empty arrays if individual integrations fail.
 */
export async function getWorkspaceData(): Promise<WorkspaceData> {
  const useLive = process.env.USE_LIVE_DATA === 'true';

  if (!useLive) {
    // Development/CI mock mode
    const { getMockData, MOCK_USER_CONTEXT } = await import('@/data/mock');
    const { items, userContext } = getMockData(new Date());
    return {
      items,
      userContext: userContext ?? MOCK_USER_CONTEXT,
      sources: { github: 0, calendar: 0, notion: 0 },
    };
  }

  // ── LIVE MODE ─────────────────────────────────────────────────────────────
  console.log('[Gravity] Loading workspace data…');

  const rawItems: WorkspaceItem[] = [];
  const sources = { github: 0, calendar: 0, notion: 0 };

  // GitHub
  try {
    const { fetchGitHubData } = await import('@/integrations/github/client');
    const items = await fetchGitHubData();
    sources.github = items.length;
    rawItems.push(...items);
  } catch (err) {
    console.error('[GitHub] ❌ Unexpected error:', err);
  }

  // Google Calendar
  try {
    const { fetchCalendarData } = await import('@/integrations/calendar/client');
    const items = await fetchCalendarData();
    sources.calendar = items.length;
    rawItems.push(...items);
  } catch (err) {
    console.error('[Calendar] ❌ Unexpected error:', err);
  }

  // Notion
  try {
    const { fetchNotionData } = await import('@/integrations/notion/client');
    const items = await fetchNotionData();
    sources.notion = items.length;
    rawItems.push(...items);
  } catch (err) {
    console.error('[Notion] ❌ Unexpected error:', err);
  }

  const total = rawItems.length;
  console.log(`[Gravity] Total items fetched: ${total} (GitHub: ${sources.github}, Calendar: ${sources.calendar}, Notion: ${sources.notion})`);

  if (total === 0) {
    console.log('[Gravity] ℹ️  No items fetched — workspace appears calm or integrations are not configured');
  }

  return {
    items:       rawItems.map(toNormalizedItem),
    userContext: buildLiveUserContext(),
    sources,
  };
}
