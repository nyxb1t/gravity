/**
 * @file app/api/slack/events/route.ts
 * @description Next.js App Router API route — HTTP mode fallback.
 *
 * NOTE: This route is only active in HTTP mode (no SLACK_APP_TOKEN).
 * In Socket Mode (current config), Bolt manages the WebSocket directly and
 * this route is never called for button clicks / events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSlackApp } from '@/slack/app';
import { bootstrapSlack } from '@/slack/bootstrap';

// Register handlers once on cold-start (HTTP mode only)
bootstrapSlack(getSlackApp());

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();

  // Handle Slack URL verification challenge
  try {
    const json = JSON.parse(body);
    if (json.type === 'url_verification') {
      return new NextResponse(json.challenge, { status: 200 });
    }
  } catch {
    // url-encoded payloads (slash commands) are not JSON — ignore parse errors
  }

  const app = getSlackApp();
  const headers = Object.fromEntries(req.headers.entries());

  // Forward payload to Bolt
  try {
    const anyApp = app as any;
    if (typeof anyApp.processEvent === 'function') {
      await anyApp.processEvent({ body, headers });
    } else if (anyApp.receiver && typeof anyApp.receiver.processEvent === 'function') {
      await anyApp.receiver.processEvent({ body, headers });
    }
  } catch (err) {
    console.error('[API/slack/events] Error processing Slack payload:', err);
  }

  return new NextResponse(null, { status: 200 });
}

// Slack sends GET during URL verification — acknowledge gracefully
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true });
}
