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

import { App } from "@slack/bolt";

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
import { gravityCommandHandler } from "./commands";
import { onAppHomeOpened, onAppMention, onMessage } from "./events";

/**
 * Call this function once during server initialisation to register all
 * active Slack handlers.
 *
 * @example
 * ```ts
 * import { getSlackApp } from "@/slack/app";
 * import { bootstrapSlack } from "@/slack/bootstrap";
 * const app = getSlackApp();
 * bootstrapSlack(app);
 * ```
 */
export function bootstrapSlack(app: App): void {
  // § SLASH COMMANDS
  app.command("/gravity", gravityCommandHandler);

  // § EVENTS
  app.event("app_home_opened", onAppHomeOpened);
  app.event("app_mention", onAppMention);
  app.event("message", onMessage);

  // § BLOCK ACTIONS
  // app.action("dismiss_item", onDismissAction);

  // § VIEW SUBMISSIONS
  // app.view("settings_modal", onSettingsModalSubmit);
}
