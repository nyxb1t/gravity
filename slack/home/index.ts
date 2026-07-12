/**
 * @file slack/home/index.ts
 * @description Public barrel for the Gravity App Home Tab experience.
 *
 * The Home Tab is an interactive canvas displayed when a user opens the
 * Gravity app directly in Slack. All Home Tab views and view-publishing
 * logic live under this directory.
 *
 * ─── HOW TO ADD HOME TAB SUPPORT ─────────────────────────────────────────
 *
 *  1. Build the view payload in `slack/home/view.ts`
 *  2. Create the publisher in `slack/home/publisher.ts`
 *  3. Export both from this file (already done below)
 *  4. Trigger from the `app_home_opened` event in slack/events/
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

export { buildHomeView, MOCK_HOME_VIEW_DATA } from "./view";
export type { HomeViewData } from "./view";
export { publishHomeView } from "./publisher";
