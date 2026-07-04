/**
 * @file slack/events/app-home-opened.ts
 * @description Handler for Slack's `app_home_opened` event.
 *
 * Triggered when a user opens the Gravity app in Slack. Publishes the Home
 * Tab when the user lands on the Home tab; all other tabs are ignored.
 *
 * Data loading is isolated in `loadHomeViewData` so Person 1's `/api/gravity`
 * integration can replace the mock source without changing this handler.
 */

import type { EventArgs } from "@/slack/types";
import { publishHomeView } from "@/slack/home/publisher";
import { MOCK_HOME_VIEW_DATA } from "@/slack/home/view";
import type { HomeViewData } from "@/slack/home/view";

// ---------------------------------------------------------------------------
// Data loading (swappable — mock today, /api/gravity tomorrow)
// ---------------------------------------------------------------------------

/**
 * Resolves the Home Tab payload for a given Slack user.
 *
 * Currently returns static mock data. Replace the body of this function
 * with a call to Person 1's `/api/gravity` endpoint and a response mapper
 * — leave `onAppHomeOpened` unchanged.
 */
async function loadHomeViewData(_userId: string): Promise<HomeViewData> {
  return MOCK_HOME_VIEW_DATA;
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
  if (event.tab !== "home") return;

  const data = await loadHomeViewData(event.user);
  await publishHomeView(event.user, data);
}
