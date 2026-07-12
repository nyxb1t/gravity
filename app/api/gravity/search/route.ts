import { NextResponse } from 'next/server';
import { runOrchestrator } from '@/ai/engine';
import { getWorkspaceData } from '@/integrations/live';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Accept variations of query/searchQuery
    const query = body.query ?? body.searchQuery ?? '';
    
    // Fetch workspace items (live or mock based on USE_LIVE_DATA)
    const { items, userContext } = await getWorkspaceData();
    
    const output = await runOrchestrator({
      items,
      context: userContext,
      mode: 'search',
      searchQuery: query,
      options: {
        debug: true,
      },
    });
    
    return NextResponse.json(output);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during search',
        },
      },
      { status: 500 }
    );
  }
}
