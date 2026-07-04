/**
 * @file slack/home/index.ts
 * @description Barrel export for the Gravity App Home Tab experience.
 *
 * The Home Tab is an interactive canvas displayed when a user opens the
 * Gravity app directly in Slack. All Home Tab views and view-publishing
 * logic live under this directory.
 *
 * ─── HOW TO ADD HOME TAB SUPPORT ─────────────────────────────────────────
 *
 *  1. Build the view payload in `slack/home/view.ts`:
 *
 *     ```ts
 *     // slack/home/view.ts
 *     import type { HomeView } from "@slack/bolt";
 *
 *     export function buildHomeView(/* ... *\/): HomeView {
 *       return { type: "home", blocks: [ /* Block Kit blocks *\/ ] };
 *     }
 *     ```
 *
 *  2. Create the publisher in `slack/home/publisher.ts`:
 *
 *     ```ts
 *     // slack/home/publisher.ts
 *     export async function publishHomeView(userId: string) { ... }
 *     ```
 *
 *  3. Export both from this file:
 *
 *     ```ts
 *     export { buildHomeView } from "./view";
 *     export { publishHomeView } from "./publisher";
 *     ```
 *
 *  4. Trigger from the `app_home_opened` event in slack/events/.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *
 * No implementations yet — this file is intentionally empty.
 */

// Placeholder — add Home Tab exports below as features are implemented.
// e.g. export { buildHomeView } from "./view";
// e.g. export { publishHomeView } from "./publisher";
