import { NextResponse } from 'next/server';
import { getWorkspaceData } from '@/integrations/live';

export async function GET(request: Request) {
  // getWorkspaceData automatically respects USE_LIVE_DATA, dynamically imports
  // integration clients when live, and falls back to mock data otherwise.
  const { items } = await getWorkspaceData();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    // Extract the raw WorkspaceItem from the NormalizedItem wrapper
    // because this route's contract serves WorkspaceItems to external callers (like MCP).
    items: items.map((i) => i.raw),
  });
}