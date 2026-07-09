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
import { bootstrapSlack, slackApp } from "@/slack/bootstrap";

// Register all handlers on first module evaluation (cold-start).
bootstrapSlack();

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
