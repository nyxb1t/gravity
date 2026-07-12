/**
 * @file integrations/live.ts
 * @description Unified live workspace data fetcher.
 *
 * When USE_LIVE_DATA=true, this module aggregates real data from GitHub,
 * Google Calendar, and Notion into a pipeline-ready `NormalizedItem[]`.
 *
 * When USE_LIVE_DATA=false, this module falls back to `getMockData()`.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────
 *
 * ```ts
 * import { getWorkspaceData } from "@/integrations/live";
 *
 * const { items, userContext } = await getWorkspaceData();
 * const result = await runOrchestrator({ items, context: userContext, mode: "lens" });
 * ```
 *
 * ─── DESIGN NOTES ─────────────────────────────────────────────────────────
 *
 *  • Each integration client is imported dynamically so they are NEVER
 *    evaluated at Next.js build time — only when actually called.
 *  • Individual integration failures are logged and gracefully skipped so
 *    a single broken integration doesn't collapse the whole response.
 *  • WorkspaceItems from live integrations are wrapped into NormalizedItem
 *    with sensible defaults (unread, not bookmarked, no conflicts yet).
 */

import type { NormalizedItem, UserContext, WorkspaceItem } from "@/types";
import { getMockData, MOCK_USER_CONTEXT } from "@/data/mock";

// ---------------------------------------------------------------------------
// WorkspaceItem → NormalizedItem converter
// ---------------------------------------------------------------------------

/**
 * Wraps a raw `WorkspaceItem` into the `NormalizedItem` shape expected by
 * the intelligence pipeline. Conflicts are left empty — the orchestrator's
 * Stage 2 (detectConflicts) populates them.
 */
function toNormalizedItem(raw: WorkspaceItem): NormalizedItem {
  return {
    raw,
    conflicts: [],
    isRead: false,
    isBookmarked: false,
    firstSeenAt: null,
    lastProcessedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WorkspaceData {
  items: NormalizedItem[];
  userContext: UserContext;
}

/**
 * Returns workspace data — live (GitHub + Calendar + Notion) when
 * USE_LIVE_DATA=true, mock otherwise.
 *
 * All integration failures are caught individually so one broken source
 * doesn't prevent the others from being returned.
 */
export async function getWorkspaceData(): Promise<WorkspaceData> {
  const useLive = process.env.USE_LIVE_DATA === "true";

  if (!useLive) {
    // ── MOCK MODE (default) ─────────────────────────────────────────────────
    const { items, userContext } = getMockData(new Date());
    return { items, userContext };
  }

  // ── LIVE MODE ─────────────────────────────────────────────────────────────
  const rawItems: WorkspaceItem[] = [];

  try {
    const { fetchGitHubData } = await import("@/integrations/github/client");
    const githubItems = await fetchGitHubData();
    rawItems.push(...githubItems);
    console.log(`[Gravity/Live] GitHub: fetched ${githubItems.length} items`);
  } catch (err) {
    console.error("[Gravity/Live] GitHub fetch failed:", err);
  }

  try {
    const { fetchCalendarData } = await import("@/integrations/calendar/client");
    const calendarItems = await fetchCalendarData();
    rawItems.push(...calendarItems);
    console.log(`[Gravity/Live] Calendar: fetched ${calendarItems.length} items`);
  } catch (err) {
    console.error("[Gravity/Live] Calendar fetch failed:", err);
  }

  try {
    const { fetchNotionData } = await import("@/integrations/notion/client");
    const notionItems = await fetchNotionData();
    rawItems.push(...notionItems);
    console.log(`[Gravity/Live] Notion: fetched ${notionItems.length} items`);
  } catch (err) {
    console.error("[Gravity/Live] Notion fetch failed:", err);
  }

  console.log(`[Gravity/Live] Total items fetched: ${rawItems.length}`);

  // Fall back to mock if all integrations failed
  if (rawItems.length === 0) {
    console.warn("[Gravity/Live] All integrations returned 0 items — falling back to mock data");
    const { items, userContext } = getMockData(new Date());
    return { items, userContext };
  }

  return {
    items: rawItems.map(toNormalizedItem),
    // The user context comes from the authenticated session in a full
    // implementation. For now, use the mock context as a placeholder
    // (the live items still flow through the intelligence pipeline correctly).
    userContext: MOCK_USER_CONTEXT,
  };
}
