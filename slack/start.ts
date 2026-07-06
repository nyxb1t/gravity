/**
 * @file slack/start.ts
 * @description Standalone entry point that boots the Slack Bolt app in Socket Mode.
 *
 * Run this process alongside `next dev` to open the persistent WebSocket
 * connection to Slack. Once started, Slack events (app_home_opened, etc.)
 * flow through the WebSocket to the registered Bolt handlers.
 *
 * ─── WHY A SEPARATE PROCESS? ─────────────────────────────────────────────
 *
 *  Socket Mode requires a long-lived WebSocket connection. Next.js is a
 *  request-scoped runtime — it spins up and tears down modules per-request,
 *  making it unsuitable for hosting a persistent WebSocket listener.
 *
 *  This script runs outside Next.js using `tsx` and owns the WebSocket for
 *  the lifetime of the dev session.
 *
 * ─── WHY NO dotenv IMPORT HERE? ──────────────────────────────────────────
 *
 *  ES module `import` statements are statically hoisted: the entire module
 *  graph is resolved and evaluated BEFORE any line of this file's body runs.
 *
 *  That means:
 *
 *    import { config as loadEnv } from "dotenv"; // ← hoisted, dotenv loaded
 *    loadEnv({ path: ".env.local" });            // ← body: runs AFTER all imports
 *    import { bootstrapSlack } from "…/bootstrap"; // ← hoisted, evaluated FIRST
 *
 *  In practice the runtime order is:
 *    1. dotenv module evaluated  (loadEnv available but not yet called)
 *    2. bootstrap → app → config evaluated → buildSlackConfig() runs
 *    3. requireEnv("SLACK_BOT_TOKEN") → process.env.SLACK_BOT_TOKEN === undefined → 💥
 *    4. loadEnv() never gets a chance to execute
 *
 *  The correct fix is to populate process.env BEFORE Node starts evaluating
 *  any module. The `--env-file .env.local` flag passed to tsx in the npm
 *  script does exactly that — it is processed by Node at the process level,
 *  before the first import is resolved.
 *
 * ─── HOW TO START ─────────────────────────────────────────────────────────
 *
 *  Terminal 1 (Next.js):   npm run dev
 *  Terminal 2 (Slack bot): npm run slack:dev
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { bootstrapSlack } from "@/slack/bootstrap";
import { slackApp } from "@/slack/app";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Register all event/command/action/view handlers defined in bootstrap.ts.
  // This is a no-op function call (side-effects fire on module evaluation),
  // but it guarantees the bootstrap module is evaluated before we start.
  bootstrapSlack();

  // Start the Bolt app.
  //
  // In Socket Mode, app.start() does two things:
  //   1. Creates a SocketModeReceiver internally (using SLACK_APP_TOKEN /
  //      slackConfig.appToken) and opens a WebSocket to api.slack.com.
  //   2. Begins dispatching incoming Slack payloads to registered listeners.
  await slackApp.start();

  console.log(
    "⚡ Gravity Slack bot is running in Socket Mode.\n" +
      "   Open the Gravity app in Slack → Home tab to trigger app_home_opened."
  );
}

// ---------------------------------------------------------------------------
// Run & handle fatal errors
// ---------------------------------------------------------------------------

main().catch((err: unknown) => {
  console.error("[Gravity/Slack] Fatal startup error:", err);
  process.exit(1);
});
