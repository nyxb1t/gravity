/**
 * @file slack/bootstrap.ts
 * @description Wires all Slack handlers onto the Bolt App instance.
 *
 * Call `bootstrapSlack()` once at startup — it retrieves the singleton app
 * and registers every handler exactly once.
 *
 * NO module-level side-effects here. The singleton is only touched inside
 * `bootstrapSlack()` so handlers are never registered twice.
 */

import type { App } from '@slack/bolt';

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
// Bootstrap — call exactly once from start.ts
// ---------------------------------------------------------------------------

let bootstrapped = false;

/**
 * Registers all active Slack handlers on the given Bolt App instance.
 * Safe to call multiple times — handlers are only registered on the first call.
 */
export function bootstrapSlack(app: App): void {
  if (bootstrapped) {
    console.warn('[Bootstrap] ⚠️  bootstrapSlack() called more than once — skipping duplicate registration');
    return;
  }
  bootstrapped = true;

  // § SLASH COMMANDS
  app.command('/gravity', gravityCommandHandler);

  // § EVENTS
  app.event('app_home_opened', onAppHomeOpened);
  app.event('app_mention',     onAppMention);
  app.event('message',         onMessage);

  // § BLOCK ACTIONS
  app.action('calendar',      onCalendarAction);
  app.action('pending_prs',   onPendingPrsAction);
  app.action('show_unread',   onShowUnreadAction);
  app.action('summarize_day', onSummarizeDayAction);

  console.log('[Bootstrap] ✅ All handlers registered (commands: 1, events: 3, actions: 4)');
}
