/**
 * @file slack/bootstrap.ts
 * @description Wires all Slack handlers onto the Bolt App instance.
 *
 * This is the single place where command, event, action, and view handlers
 * are registered with `slackApp`. Import and call `bootstrapSlack(app)` once
 * during server initialisation.
 */

import { App } from '@slack/bolt';
import { getSlackApp } from './app';

// ---------------------------------------------------------------------------
// § SLASH COMMANDS
// ---------------------------------------------------------------------------
import { gravityCommandHandler } from './commands';

// ---------------------------------------------------------------------------
// § EVENTS
// ---------------------------------------------------------------------------
import { onAppHomeOpened, onAppMention, onMessage } from './events';

// ---------------------------------------------------------------------------
// § BLOCK ACTIONS
// ---------------------------------------------------------------------------
import {
  onCalendarAction,
  onPendingPrsAction,
  onShowUnreadAction,
  onSummarizeDayAction,
} from './actions/quick-actions';

// ---------------------------------------------------------------------------
// Bootstrap function — call once at startup
// ---------------------------------------------------------------------------

/**
 * Registers all active Slack handlers on the given Bolt App instance.
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
  app.command('/gravity', gravityCommandHandler);

  // § EVENTS — registered exactly once each
  app.event('app_home_opened', onAppHomeOpened);
  app.event('app_mention',     onAppMention);
  app.event('message',         onMessage);

  // § BLOCK ACTIONS
  app.action('calendar',     onCalendarAction);
  app.action('pending_prs',  onPendingPrsAction);
  app.action('show_unread',  onShowUnreadAction);
  app.action('summarize_day', onSummarizeDayAction);
}

// Export singleton for modules that need it directly
export const slackApp = getSlackApp();
