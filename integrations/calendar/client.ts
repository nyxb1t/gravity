/**
 * @file integrations/calendar/client.ts
 * @description Live Google Calendar integration.
 *
 * Env vars required:
 *   GOOGLE_CLIENT_ID      – OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET  – OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN  – Long-lived refresh token
 */

import { google } from 'googleapis';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCalendarEnv(): boolean {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID)     missing.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!process.env.GOOGLE_REFRESH_TOKEN) missing.push('GOOGLE_REFRESH_TOKEN');

  if (missing.length > 0) {
    console.error(`[Calendar] ❌ Missing env vars: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

// ---------------------------------------------------------------------------
// Public fetcher
// ---------------------------------------------------------------------------

export async function fetchCalendarData(): Promise<WorkspaceItem[]> {
  if (!validateCalendarEnv()) {
    console.warn('[Calendar] ⚠️  Skipping — missing credentials. Returning empty.');
    return [];
  }

  console.log('[Calendar] 🔄 Authenticating with Google OAuth2…');

  let events: any[] = [];

  try {
    const calendar = getCalendarClient();

    const now          = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      now.toISOString(),
      timeMax:      oneWeekLater.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   20,
    });

    console.log('[Calendar] ✅ Authentication success');

    events = response.data.items || [];
    console.log(`[Calendar] 📅 Fetched ${events.length} events (next 7 days)`);
  } catch (err: any) {
    const msg = err?.message ?? String(err);

    if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
      console.error('[Calendar] ❌ Refresh token invalid or expired — regenerate GOOGLE_REFRESH_TOKEN');
    } else if (msg.includes('invalid_client')) {
      console.error('[Calendar] ❌ Invalid client credentials — check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    } else if (msg.includes('Calendar API has not been used')) {
      console.error('[Calendar] ❌ Google Calendar API not enabled in Cloud Console for this project');
    } else {
      console.error('[Calendar] ❌ Failed to fetch:', msg);
    }
    return [];
  }

  return events.map(GravityNormalizer.fromGoogleCalendar);
}