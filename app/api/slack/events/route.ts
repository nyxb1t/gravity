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
 *    requests are handled by the already-registered listeners.
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
import { bootstrapSlack } from "@/slack/bootstrap";

// Register all handlers on first module evaluation (cold-start).
bootstrapSlack();

/**
 * Handle all POST requests from Slack (events, commands, interactivity).
 *
 * Bolt's Next.js receiver is not yet part of the public API, so we forward
 * the raw body to Bolt's processEvent machinery. Once @slack/bolt ships
 * an official Next.js App Router receiver this handler can be replaced.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Wire Bolt's receiver here once @slack/bolt supports Next.js
  // App Router natively, or integrate with a custom receiver adapter.
  //
  // For now this stub confirms the route exists and returns 200 so Slack's
  // URL verification challenge succeeds during initial setup.
  //
  // Reference implementation (using a custom receiver):
  //   const body = await req.text();
  //   const headers = Object.fromEntries(req.headers.entries());
  //   await slackApp.processEvent({ body, headers });
  //   return new NextResponse(null, { status: 200 });

  return new NextResponse(
    JSON.stringify({ message: "Slack route placeholder — not yet wired." }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// Slack sends GET during URL verification — acknowledge gracefully.
export async function GET(): Promise<NextResponse> {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
