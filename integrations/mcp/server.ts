
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

async function getWorkspaceContext() {
  if (process.env.USE_LIVE_DATA !== 'true') {
    // Mock mode — same shape as live data
    return {
      timestamp: new Date().toISOString(),
      items: [
        {
          id: 'github-101',
          source: 'github',
          type: 'issue',
          title: 'Critical auth bypass in login handler',
          status: 'open',
          updatedAt: new Date().toISOString(),
          assignees: ['jane_doe'],
          metadata: { labels: ['bug', 'critical'], isCritical: true }
        },
        {
          id: 'notion-303',
          source: 'notion',
          type: 'task',
          title: 'Sign-off on Q3 Architecture Roadmap',
          status: 'pending_approval',
          updatedAt: new Date().toISOString(),
          assignees: ['bob_pm'],
          metadata: { parentProject: 'Core Infrastructure' }
        },
        {
          id: 'calendar-505',
          source: 'calendar',
          type: 'event',
          title: 'Urgent QA Defect Review Sync',
          status: 'scheduled',
          updatedAt: new Date().toISOString(),
          assignees: ['jane_doe', 'qa_team'],
          metadata: {
            startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString()
          }
        }
      ]
    };
  }

  // Live mode — import all three clients
  const { fetchGitHubData }   = await import('../github/client.js');
  const { fetchNotionData }   = await import('../notion/client.js');
  const { fetchCalendarData } = await import('../calendar/client.js');

  const [github, notion, calendar] = await Promise.allSettled([
    fetchGitHubData(),
    fetchNotionData(),
    fetchCalendarData()
  ]);

  const items = [
    ...(github.status   === 'fulfilled' ? github.value   : []),
    ...(notion.status   === 'fulfilled' ? notion.value   : []),
    ...(calendar.status === 'fulfilled' ? calendar.value : [])
  ];

  return {
    timestamp: new Date().toISOString(),
    items
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