import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { getWorkspaceData } from '../live.js';

async function getWorkspaceContext() {
  // getWorkspaceData automatically respects USE_LIVE_DATA, dynamically imports
  // integration clients when live, and falls back to mock data otherwise.
  const { items } = await getWorkspaceData();

  return {
    timestamp: new Date().toISOString(),
    // Extract the raw WorkspaceItem from the NormalizedItem wrapper
    // because this route's contract serves WorkspaceItems to external callers.
    items: items.map(i => i.raw)
  };
}

// ── MCP Server ─────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'gravity-integrations-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_unified_workspace_context',
      description:
        'Returns normalized tasks, events, issues, and PRs from GitHub, Notion, and Google Calendar. Use this to understand what is currently happening across the workspace for a given user.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_unified_workspace_context') {
    try {
      const context = await getWorkspaceContext();
      return {
        content: [{ type: 'text', text: JSON.stringify(context, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching workspace context: ${err}` }],
        isError: true
      };
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ── Start ──────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Gravity MCP server running');
}

main().catch(console.error);