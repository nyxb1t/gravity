/**
 * @file slack/events/index.ts
 * @description Barrel export for all Gravity Slack event handlers.
 *
 * Register each event handler module here as it is implemented.
 * The parent bootstrap module (slack/bootstrap.ts) imports this file to
 * attach all listeners to the Bolt App in one shot.
 *
 * ─── HOW TO ADD AN EVENT HANDLER ─────────────────────────────────────────
 *
 *  1. Create `slack/events/your-event.ts` and export a typed handler:
 *
 *     ```ts
 *     // slack/events/your-event.ts
 *     import type { SlackEventMiddlewareArgs } from "@slack/bolt";
 *
 *     export async function onYourEvent({
 *       event,
 *       client,
 *     }: SlackEventMiddlewareArgs<"your_event">) {
 *       // TODO: implement
 *     }
 *     ```
 *
 *  2. Export it from this file:
 *
 *     ```ts
 *     export { onYourEvent } from "./your-event";
 *     ```
 *
 *  3. Wire it up in slack/bootstrap.ts:
 *
 *     ```ts
 *     slackApp.event("your_event", onYourEvent);
 *     ```
 *
 * ──────────────────────────────────────────────────────────────────────────
 *
 * No handlers are registered yet — this file is intentionally empty.
 * It exists to establish the module boundary and guide future contributors.
 */

// Placeholder — add event exports below as features are implemented.
// e.g. export { onMessage } from "./message";
// e.g. export { onAppMention } from "./app-mention";
// e.g. export { onAppHomeOpened } from "./app-home-opened";
