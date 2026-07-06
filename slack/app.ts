/**
 * @file slack/app.ts
 * @description Singleton Slack Bolt App instance for the Gravity project.
 *
 * This module initialises the Bolt App exactly once and exports it for
 * consumption by handlers, middleware, and the Next.js API route that
 * receives Slack payloads.
 *
 * Responsibilities of THIS file:
 *   ✓ Instantiate @slack/bolt App
 *   ✓ Pass validated config from slack/config.ts
 *   ✓ Export the singleton `slackApp` and its `receiver`
 *
 * Responsibilities of OTHER files:
 *   ✗ Slash commands  → slack/commands/
 *   ✗ Event handlers  → slack/events/
 *   ✗ Home Tab UI     → slack/home/
 *   ✗ Block Kit       → slack/blocks/
 *   ✗ OAuth           → handled by Person 3 (integrations owner)
 */

import { App, LogLevel } from "@slack/bolt";
import { slackConfig } from "@/slack/config";

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------

/**
 * Determine the Bolt log level from the runtime environment.
 * - In production → WARN (reduce noise)
 * - In development → DEBUG (maximum visibility)
 */
function resolveLogLevel(): LogLevel {
  const env = process.env.NODE_ENV;
  if (env === "production") return LogLevel.WARN;
  if (env === "test") return LogLevel.ERROR;
  return LogLevel.DEBUG;
}

/**
 * The singleton Slack Bolt App instance.
 *
 * Socket Mode is enabled when `SLACK_APP_TOKEN` is present in the environment
 * (see slack/config.ts). In HTTP mode the app listens on `slackConfig.port`.
 *
 * @example
 * ```ts
 * import { slackApp } from "@/slack/app";
 *
 * // Register a command handler from slack/commands/
 * slackApp.command("/gravity", myCommandHandler);
 * ```
 */
export const slackApp = new App({
  token: slackConfig.botToken,
  signingSecret: slackConfig.signingSecret,

  // Socket Mode — requires SLACK_APP_TOKEN.
  // When false, the app expects an HTTP receiver.
  ...(slackConfig.socketMode
    ? {
        socketMode: true,
        appToken: slackConfig.appToken,
      }
    : {
        port: slackConfig.port,
      }),

  logLevel: resolveLogLevel(),
});

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------

export default slackApp;
