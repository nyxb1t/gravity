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
import { getSlackConfig } from "@/slack/config";

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

let appInstance: App | null = null;

/**
 * Returns the singleton Slack Bolt App instance.
 * Lazily initialized to prevent any side effects or env validations at build time.
 */
export function getSlackApp(): App {
  if (!appInstance) {
    const config = getSlackConfig();
    appInstance = new App({
      token: config.botToken,
      signingSecret: config.signingSecret,

      // Socket Mode — requires appToken.
      // When false, the app expects an HTTP receiver.
      ...(config.socketMode
        ? {
            socketMode: true,
            appToken: config.appToken,
          }
        : {
            port: config.port,
          }),

      logLevel: resolveLogLevel(),
    });
  }
  return appInstance;
}

export default getSlackApp;
