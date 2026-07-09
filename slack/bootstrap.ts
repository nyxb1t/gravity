/**
 * @file slack/bootstrap.ts
 * @description Wires all Slack handlers onto the Bolt App instance.
 *
 * This module is the single place where command, event, action, and view
 * handlers are registered with `slackApp`. It is imported once by the
 * Next.js API route that handles incoming Slack requests.
 *
 * ─── REGISTRATION PATTERN ────────────────────────────────────────────────
 *
 *  When a new handler is ready to activate:
 *
 *  1. Import the handler from its feature module:
 *     ```ts
 *     import { gravityCommandHandler } from "./commands/gravity";
 *     ```
 *
 *  2. Register it in the appropriate section below:
 *     ```ts
 *     slackApp.command("/gravity", gravityCommandHandler);
 *     ```
 *
 * ─── SECTION LAYOUT ──────────────────────────────────────────────────────
 *
 *   § SLASH COMMANDS   — /gravity, /focus, etc.
 *   § EVENTS           — message, app_mention, app_home_opened, etc.
 *   § BLOCK ACTIONS    — button clicks, select menus, etc.
 *   § VIEW SUBMISSIONS — modal submit / cancel callbacks
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Keep handler imports grouped by section and sorted alphabetically within
 * each section to make diffs easy to review.
 */

import { slackApp } from "@/slack/app";

// ---------------------------------------------------------------------------
// § SLASH COMMANDS
// ---------------------------------------------------------------------------
// import { gravityCommandHandler } from "./commands/gravity";
// slackApp.command("/gravity", gravityCommandHandler);

// ---------------------------------------------------------------------------
// § EVENTS
// ---------------------------------------------------------------------------
import { onAppHomeOpened } from "./events/app-home-opened";
// import { onAppMention } from "./events/app-mention";
// import { onMessage }    from "./events/message";

slackApp.event("app_home_opened", onAppHomeOpened);
// slackApp.event("app_mention", onAppMention);
// slackApp.event("message",     onMessage);

// ---------------------------------------------------------------------------
// § BLOCK ACTIONS
// ---------------------------------------------------------------------------
import {
  onCalendarAction,
  onPendingPrsAction,
  onShowUnreadAction,
  onSummarizeDayAction,
} from "./actions/quick-actions";
// import { onDismissAction } from "./actions/dismiss";
// slackApp.action("dismiss_item", onDismissAction);

slackApp.action("calendar", onCalendarAction);
slackApp.action("pending_prs", onPendingPrsAction);
slackApp.action("show_unread", onShowUnreadAction);
slackApp.action("summarize_day", onSummarizeDayAction);

// ---------------------------------------------------------------------------
// § VIEW SUBMISSIONS
// ---------------------------------------------------------------------------
// import { onSettingsModalSubmit } from "./views/settings-modal";
// slackApp.view("settings_modal", onSettingsModalSubmit);

// ---------------------------------------------------------------------------
// Export the bootstrapped app for use in the Next.js API route
// ---------------------------------------------------------------------------

/**
 * Call this function once during server initialisation to register all
 * active Slack handlers. Idempotent — safe to call multiple times (Bolt
 * de-duplicates listener registration internally).
 *
 * @example
 * ```ts
 * // app/api/slack/events/route.ts
 * import { bootstrapSlack } from "@/slack/bootstrap";
 * bootstrapSlack();
 * ```
 */
export function bootstrapSlack(): void {
  // All registrations are performed at import time via the top-level calls
  // above. This function intentionally has no body — it exists solely as a
  // named export that forces the module to be evaluated (and all
  // `slackApp.xxx()` calls to execute) when called from the API route.
  //
  // This pattern avoids accidental tree-shaking of side-effectful imports
  // in bundlers that do not mark @slack/bolt as sideEffect-free.
}

export { slackApp };
