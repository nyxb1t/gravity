import { google } from 'googleapis';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return google.calendar({ version: 'v3', auth });
}

export async function fetchCalendarData(): Promise<WorkspaceItem[]> {
  const calendar = getCalendarClient();

  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: oneWeekLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20
  });

  const events = response.data.items || [];
  return events.map(GravityNormalizer.fromGoogleCalendar);
}