/**
 * @file slack/home/publisher.ts
 * @description Publishes the Gravity App Home Tab to a Slack user.
 */

import { getSlackApp } from '@/slack/app';
import { buildHomeView } from './view';
import type { HomeViewData } from './view';

/**
 * Builds and publishes the Gravity Home Tab for the given Slack user.
 *
 * @param userId      - Slack member ID (e.g. "U04ABC123").
 * @param data        - Pre-formatted view data to render on the Home Tab.
 * @param displayName - Optional display name to personalise the greeting header.
 */
export async function publishHomeView(
  userId:      string,
  data:        HomeViewData,
  displayName?: string
): Promise<void> {
  // Attach displayName as a hidden field so buildGravityHeader can use it
  // without changing the HomeViewData contract
  const enrichedData = displayName
    ? Object.assign({}, data, { __displayName: displayName })
    : data;

  const app = getSlackApp();
  await app.client.views.publish({
    user_id: userId,
    view:    buildHomeView(enrichedData),
  });
}
