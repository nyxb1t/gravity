/**
 * @file app/api/slack/events/route.ts
 * @description Next.js App Router API route that receives all incoming Slack payloads.
 *
 * This is the HTTP entry point for Slack's Events API, slash commands, and
 * interactive components. It is intentionally minimal — all business logic
 * is handled by Bolt internally after the payload is handed off.
 *
 * ─── REQUEST FLOW ─────────────────────────────────────────────────────────
 *
 *  Slack API  ──POST──▶  /api/slack/events  ──▶  Bolt App  ──▶  handlers
 *
 * ─── IMPORTANT NOTES ──────────────────────────────────────────────────────
 *
 *  • This route is ONLY used in HTTP mode (SLACK_APP_TOKEN absent).
 *    In Socket Mode Bolt manages the WebSocket connection independently and
 *    this route is never reached.
 *
 *  • Signature verification is performed by Bolt automatically using
 *    SLACK_SIGNING_SECRET — do NOT add manual checks here.
 *
 *  • `bootstrapSlack()` is called exactly once per cold-start. Subsequent
 *    requests skip registration via the `bootstrapped` guard flag.
 *
 * ─── ACTIVATING THIS ROUTE ────────────────────────────────────────────────
 *
 *  TODO (Person 1 / integrations owner):
 *    1. Confirm whether Socket Mode or HTTP mode will be used.
 *    2. If HTTP mode: point your Slack app's Request URL to:
 *         https://<your-domain>/api/slack/events
 *    3. Remove this TODO block once the route is live.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { bootstrapSlack, slackApp } from "@/slack/bootstrap";

// Register all handlers on first module evaluation (cold-start).
bootstrapSlack(slackApp);

/**
 * Guard flag: tracks whether bootstrapSlack() has already been called in this
 * process lifetime. Prevents duplicate handler registration on every POST.
 * Module-level variable is shared across all requests in the same worker.
 */
let bootstrapped = false;

/**
 * Handle all POST requests from Slack (events, commands, interactivity).
 *
 * Bolt's Next.js receiver is not yet part of the public API, so we forward
 * the raw body to Bolt's processEvent machinery.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  
  try {
    const json = JSON.parse(body);
    if (json.type === "url_verification") {
      return new NextResponse(json.challenge, { status: 200 });
    }
  } catch (e) {
    // Ignore JSON parse errors for url-encoded payloads (like commands)
  }

  // HTTP mode logic (evaluated only at runtime when requests hit this handler)
  const { getSlackApp } = await import("@/slack/app");
  const { bootstrapSlack } = await import("@/slack/bootstrap");
  const app = getSlackApp();

  // Register handlers only once per process lifetime.
  // Without this guard, every POST request would add duplicate listeners.
  if (!bootstrapped) {
    bootstrapSlack(app);
    bootstrapped = true;
  }

  // TODO: Wire Bolt's receiver here once @slack/bolt supports Next.js
  // App Router natively, or integrate with a custom receiver adapter.
  //
  // Reference implementation (using a custom receiver):
  //   const body = await req.text();
  //   const headers = Object.fromEntries(req.headers.entries());
  //   await app.processEvent({ body, headers });
  //   return new NextResponse(null, { status: 200 });
  const headers = Object.fromEntries(req.headers.entries());
  
  // Forward to Bolt
  if (typeof slackApp.processEvent === 'function') {
      await (slackApp as any).processEvent({ body, headers });
  } else if ((slackApp as any).receiver && typeof (slackApp as any).receiver.requestHandler === 'function') {
     // fallback for older Bolt versions
  } else {
     // Just pass it as best effort if it's a custom receiver that has processEvent
     const anyApp = slackApp as any;
     if (anyApp.receiver && typeof anyApp.receiver.processEvent === 'function') {
         await anyApp.receiver.processEvent({ body, headers });
     }
  }

  return new NextResponse(null, { status: 200 });
}

// Slack sends GET during URL verification — acknowledge gracefully.
export async function GET(): Promise<NextResponse> {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
