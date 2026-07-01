import { NextResponse } from 'next/server';
import { runOrchestrator } from '@/ai/engine';
import { getMockData } from '@/data/mock';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Accept variations of query/searchQuery and userContext/context/user_context
    const query = body.query ?? body.searchQuery ?? '';
    const userContext = body.userContext ?? body.context ?? body.user_context;
    
    // Get mock data (which provides default mock context and workspace items)
    // We instantiate mock data with current date/time to make scoring realistic
    const { items, userContext: defaultUserContext } = getMockData(new Date());
    
    // Use provided user context, or fallback to the mock one
    const contextToUse = userContext ?? defaultUserContext;
    
    const output = await runOrchestrator({
      items,
      context: contextToUse,
      mode: 'search',
      searchQuery: query,
      options: {
        debug: true, // Enable debug to populate meta details if needed
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
