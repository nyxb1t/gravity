/**
 * @file slack/events/app-home-opened.ts
 * @description Handler for Slack's `app_home_opened` event.
 *
 * Triggered when a user opens the Gravity app in Slack. Publishes the Home
 * Tab when the user lands on the Home tab; all other tabs are ignored.
 *
 * Data source is controlled by the USE_LIVE_DATA environment variable:
 *  - USE_LIVE_DATA=true  → real data from GitHub, Google Calendar, and Notion,
 *                          mapped into HomeViewData via the orchestrator
 *  - USE_LIVE_DATA=false → mock HomeViewData (default, safe for development/CI)
 */

import type { EventArgs } from "@/slack/types";
import type { DetectedConflict } from "@/ai/conflicts";
import { publishHomeView } from "@/slack/home/publisher";
import { MOCK_HOME_VIEW_DATA } from "@/slack/home/view";
import type { HomeViewData } from "@/slack/home/view";

// ---------------------------------------------------------------------------
// Data loading (swappable — mock today, live when USE_LIVE_DATA=true)
// ---------------------------------------------------------------------------

/**
 * Resolves the Home Tab payload for a given Slack user.
 *
 * When USE_LIVE_DATA=true, fetches real workspace data through the orchestrator
 * and maps the top priorities into the HomeViewData structure.
 *
 * When USE_LIVE_DATA=false (default), returns static mock data for development.
 */
async function loadHomeViewData(_userId: string): Promise<HomeViewData> {
  const useLive = process.env.USE_LIVE_DATA === "true";

  if (!useLive) {
    return MOCK_HOME_VIEW_DATA;
  }

  try {
    const { getWorkspaceData } = await import("@/integrations/live");
    const { runOrchestrator } = await import("@/ai/engine");
    const { formatRelativeTime } = await import("@/slack/utils");

    const { items, userContext } = await getWorkspaceData();

    const orchestratorResult = await runOrchestrator({
      items,
      context: userContext,
      mode: "lens",
      options: { topN: 5 },
    });

    // Map ranked items → HomeViewData priorities
    const priorities = orchestratorResult.rankedItems.slice(0, 5).map((ranked) => ({
      id: ranked.item.raw.id,
      title: ranked.item.raw.title,
      url: ranked.item.raw.url,
      body: ranked.item.raw.body,
      source: ranked.item.raw.source,
      urgency: ranked.score.urgency,
      author: ranked.item.raw.author?.displayName,
      channel: ranked.item.raw.channel,
      timestamp: ranked.item.raw.createdAt
        ? formatRelativeTime(ranked.item.raw.createdAt)
        : undefined,
    }));

    // Map detected conflicts → alerts
    const alerts = orchestratorResult.conflictResult.conflicts
      .slice(0, 3)
      .map((conflict) => {
        // DetectedConflict (from ai/conflicts) extends the base Conflict type
        // with `explanation` and `suggestedActions`. Cast is safe here.
        const dc = conflict as DetectedConflict;
        return {
          type: (dc.severity === "critical"
            ? "error"
            : dc.severity === "high"
            ? "warning"
            : "info") as "error" | "warning" | "info",
          title: dc.description,
          message: dc.explanation ?? dc.description,
          footer: dc.detectedAt
            ? `Detected at ${new Date(dc.detectedAt).toLocaleTimeString()}`
            : undefined,
        };
      });

    return {
      header: {
        title: "Gravity — Your Workspace Digest",
        subtitle: `Showing ${priorities.length} priority items · Live data · Last synced just now`,
      },
      priorities,
      channels: [], // Future: map live channels from integration data
      collaborators: [], // Future: map live collaborators from integration data
      alerts,
      meetings: [],     
  insights: [],
    };
  } catch (err) {
    console.error("[Gravity/HomeTab] Failed to load live data, falling back to mock:", err);
    return MOCK_HOME_VIEW_DATA;
  }
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

/**
 * Publishes the Gravity Home Tab when a user opens the app's Home tab.
 */
export async function onAppHomeOpened({
  event,
}: EventArgs<"app_home_opened">): Promise<void> {
  console.log("🚨 APP HOME OPENED EVENT FIRED");
  if (event.tab !== "home") return;

  const data = await loadHomeViewData(event.user);
  await publishHomeView(event.user, data);
}
