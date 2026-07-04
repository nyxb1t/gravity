/**
 * @file slack/home/publisher.ts
 * @description Publishes the Gravity App Home Tab to a Slack user.
 *
 * This module is responsible solely for calling `views.publish` with a
 * pre-built Home Tab payload. Data fetching and view composition happen
 * upstream — callers supply `HomeViewData` and this function handles delivery.
 */

import { slackApp } from "@/slack/app";
import { buildHomeView } from "./view";
import type { HomeViewData } from "./view";

/**
 * Builds and publishes the Gravity Home Tab for the given Slack user.
 *
 * @param userId - Slack member ID (e.g. "U04ABC123").
 * @param data   - Pre-formatted view data to render on the Home Tab.
 */
export async function publishHomeView(
  userId: string,
  data: HomeViewData
): Promise<void> {
  await slackApp.client.views.publish({
    user_id: userId,
    view: buildHomeView(data),
  });
}
