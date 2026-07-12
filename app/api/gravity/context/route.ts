import { NextResponse } from 'next/server';
import { WorkspaceItem } from '@/types';

export async function GET(request: Request) {
  const { fetchGitHubData }   = await import('@/integrations/github/client');
  const { fetchCalendarData } = await import('@/integrations/calendar/client');
  const { fetchNotionData }   = await import('@/integrations/notion/client');

  let githubItems: WorkspaceItem[]   = [];
let calendarItems: WorkspaceItem[] = [];
let notionItems: WorkspaceItem[]   = [];

  try { githubItems   = await fetchGitHubData();   } catch (err) { console.error('GitHub failed:', err); }
  try { calendarItems = await fetchCalendarData(); } catch (err) { console.error('Calendar failed:', err); }
  try { notionItems   = await fetchNotionData();   } catch (err) { console.error('Notion failed:', err); }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    items: [...githubItems, ...calendarItems, ...notionItems]
  });
}