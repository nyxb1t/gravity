/**
 * @file slack/events/message.ts
 * @description Reactive AI assistant for Gravity DMs.
 *
 * Handles messages in the Slack "Messages" tab (1-on-1 DMs with the bot).
 * Uses intent classification to fetch only the data relevant to the query,
 * never dumping the entire workspace context on every message.
 *
 * Intent routing:
 *  greeting  → friendly "Hey 👋" with a quick workspace status summary
 *  meetings  → calendar events only
 *  blockers  → GitHub labels + Notion status
 *  github    → GitHub issues and PRs only
 *  notion    → Notion pages only
 *  tasks     → all sources, tasks view
 *  focus     → prioritized view across all sources (orchestrator lens mode)
 *  unknown   → acknowledge and offer help options
 */

import type { EventArgs } from '@/slack/types';
import { classifyIntent }  from './intent';
import { getWorkspaceData } from '@/integrations/live';
import { runOrchestrator }  from '@/ai/engine';
import {
  formatPrioritiesBlocks,
  formatSearchBlocks,
  formatRelativeTime,
} from '@/slack/utils';
import { buildSectionBlock } from '@/slack/blocks';
import type { KnownBlock }   from '@/slack/blocks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a list of items into a compact bullet-point text block. */
function buildItemListText(items: Array<{ title: string; url?: string; source: string }>): string {
  if (items.length === 0) return '';
  return items
    .slice(0, 5)
    .map((item) => `• *${item.title}* _(${item.source})_${item.url ? ` — <${item.url}|view>` : ''}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Per-intent response builders
// ---------------------------------------------------------------------------

async function handleGreeting(displayName: string): Promise<{ text: string; blocks: KnownBlock[] }> {
  // Fetch a quick summary to attach to the greeting
  let summaryLine = '';
  try {
    const { items, sources } = await getWorkspaceData();
    const total = items.length;
    const parts: string[] = [];
    if (sources.github   > 0) parts.push(`${sources.github} GitHub item${sources.github !== 1 ? 's' : ''}`);
    if (sources.calendar > 0) parts.push(`${sources.calendar} upcoming meeting${sources.calendar !== 1 ? 's' : ''}`);
    if (sources.notion   > 0) parts.push(`${sources.notion} Notion page${sources.notion !== 1 ? 's' : ''}`);

    if (total === 0) {
      summaryLine = ' Your workspace looks clear right now 🎉';
    } else {
      summaryLine = ` Your workspace has ${parts.join(', ')}.`;
    }
  } catch {
    summaryLine = '';
  }

  const name = displayName.split(' ')[0]; // First name only
  const text = `Hey ${name} 👋${summaryLine}\n\nAsk me things like:\n• "What are my tasks?"\n• "Any meetings today?"\n• "What should I focus on?"\n• "Any blockers?"`;
  const blocks: KnownBlock[] = [
    ...buildSectionBlock({ text }),
  ];
  return { text, blocks };
}

async function handleMeetings(): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { fetchCalendarData } = await import('@/integrations/calendar/client');
  const items = await fetchCalendarData();

  if (items.length === 0) {
    const text = '📅 No upcoming meetings in the next 7 days.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  const meetingLines = items
    .slice(0, 5)
    .map((item) => {
      const start = item.metadata?.startTime
        ? new Date(item.metadata.startTime as string).toLocaleString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : 'Scheduled';
      return `• *${item.title}* — ${start}${item.url ? ` (<${item.url}|join>)` : ''}`;
    })
    .join('\n');

  const text = `📅 *Upcoming meetings:*\n${meetingLines}`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

async function handleBlockers(): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { fetchGitHubData } = await import('@/integrations/github/client');
  const { fetchNotionData } = await import('@/integrations/notion/client');

  const [githubItems, notionItems] = await Promise.all([
    fetchGitHubData().catch(() => []),
    fetchNotionData().catch(() => []),
  ]);

  const blockers = [
    ...githubItems.filter((i) =>
      i.tags?.some((t) => ['blocker', 'blocked', 'bug', 'critical'].includes(t.toLowerCase()))
    ),
    ...notionItems.filter((i) =>
      i.tags?.some((t) => ['blocked', 'in progress', 'todo'].includes(t.toLowerCase()))
    ),
  ];

  if (blockers.length === 0) {
    const text = '✅ No blockers detected in GitHub or Notion right now.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  const listText = buildItemListText(blockers.map((b) => ({ title: b.title, url: b.url, source: b.source })));
  const text = `⚠️ *${blockers.length} potential blocker${blockers.length !== 1 ? 's' : ''} found:*\n${listText}`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

async function handleGitHub(): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { fetchGitHubData } = await import('@/integrations/github/client');
  const items = await fetchGitHubData();

  if (items.length === 0) {
    const text = '🐙 No open GitHub issues or pull requests found.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  const issues = items.filter((i) => i.kind === 'issue');
  const prs    = items.filter((i) => i.kind === 'pr_review');
  const lines  = [
    issues.length > 0 ? `*Issues (${issues.length}):*\n${buildItemListText(issues.map((i) => ({ title: i.title, url: i.url, source: 'GitHub' })))}` : null,
    prs.length    > 0 ? `*Pull Requests (${prs.length}):*\n${buildItemListText(prs.map((p) => ({ title: p.title, url: p.url, source: 'GitHub' })))}` : null,
  ].filter(Boolean).join('\n\n');

  const text = `🐙 *GitHub — ${items.length} open item${items.length !== 1 ? 's' : ''}:*\n${lines}`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

async function handleNotion(): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { fetchNotionData } = await import('@/integrations/notion/client');
  const items = await fetchNotionData();

  if (items.length === 0) {
    const text = '📝 No pending Notion pages found.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  const listText = buildItemListText(items.map((i) => ({ title: i.title, url: i.url, source: 'Notion' })));
  const text = `📝 *Notion — ${items.length} page${items.length !== 1 ? 's' : ''}:*\n${listText}`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

async function handleTasks(): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { items, sources } = await getWorkspaceData();

  if (items.length === 0) {
    const text = '✅ No active tasks found across GitHub, Notion, or Calendar.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  const allRaw = items.map((i) => i.raw);
  const listText = buildItemListText(allRaw.map((r) => ({ title: r.title, url: r.url, source: r.source })));
  const sourceSummary = [
    sources.github   > 0 ? `${sources.github} GitHub` : null,
    sources.notion   > 0 ? `${sources.notion} Notion` : null,
    sources.calendar > 0 ? `${sources.calendar} Calendar` : null,
  ].filter(Boolean).join(', ');

  const text = `📋 *Your tasks (${items.length} items — ${sourceSummary}):*\n${listText}`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

async function handleFocus(userContext: any): Promise<{ text: string; blocks: KnownBlock[] }> {
  const { items, userContext: ctx } = await getWorkspaceData();

  if (items.length === 0) {
    const text = '🎉 Everything looks clear! No priority items to action right now.';
    return { text, blocks: [...buildSectionBlock({ text })] };
  }

  console.log(`[Gravity] Running orchestrator for focus query — ${items.length} items`);

  const result = await runOrchestrator({
    items,
    context: ctx,
    mode:    'lens',
    options: { topN: 3, debug: false },
  });

  const blocks = formatPrioritiesBlocks(result.rankedItems);
  return {
    text: "Here's what to focus on:",
    blocks,
  };
}

async function handleUnknown(query: string): Promise<{ text: string; blocks: KnownBlock[] }> {
  // Try a search if the query looks meaningful
  if (query.length > 3) {
    const { items, userContext: ctx } = await getWorkspaceData();
    if (items.length > 0) {
      const result = await runOrchestrator({
        items,
        context:     ctx,
        mode:        'search',
        searchQuery: query,
        options:     { topN: 3, debug: false },
      });

      if (result.rankedItems.length > 0) {
        return {
          text: `Search results for "${query}":`,
          blocks: formatSearchBlocks(query, result.rankedItems),
        };
      }
    }
  }

  const text = `I'm not sure what you mean by _"${query || 'that'}"_. Try asking me:\n• "What are my tasks?"\n• "Any meetings today?"\n• "What should I focus on?"\n• "Any blockers?"\n• "Show GitHub issues"\n• "Show Notion docs"`;
  return { text, blocks: [...buildSectionBlock({ text })] };
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

export async function onMessage({
  event,
  client,
  logger,
}: EventArgs<'message'>): Promise<void> {
  const messageEvent = event as any;

  // Ignore bot messages and subtypes (e.g. thread_broadcast)
  if (messageEvent.bot_id || messageEvent.subtype) return;

  // Only handle 1-on-1 DMs (Messages tab)
  const isIM =
    messageEvent.channel_type === 'im' ||
    (messageEvent.channel && messageEvent.channel.startsWith('D'));
  if (!isIM) return;

  const rawText    = (messageEvent.text || '').trim();
  const thread_ts  = messageEvent.thread_ts ?? messageEvent.ts;
  const intent     = classifyIntent(rawText);
  const useLive    = process.env.USE_LIVE_DATA === 'true';

  logger.info(`[Messages] DM received. Intent: "${intent}". Query: "${rawText}". Live: ${useLive}`);

  // Resolve the user's display name from Slack
  let displayName = 'there';
  try {
    const userInfo = await client.users.info({ user: messageEvent.user });
    displayName = (userInfo.user as any)?.profile?.display_name
      || (userInfo.user as any)?.real_name
      || (userInfo.user as any)?.name
      || 'there';
  } catch {
    // If user lookup fails, default is fine
  }

  try {
    let response: { text: string; blocks: KnownBlock[] };

    switch (intent) {
      case 'greeting':
        response = await handleGreeting(displayName);
        break;
      case 'meetings':
        response = await handleMeetings();
        break;
      case 'blockers':
        response = await handleBlockers();
        break;
      case 'github':
        response = await handleGitHub();
        break;
      case 'notion':
        response = await handleNotion();
        break;
      case 'tasks':
        response = await handleTasks();
        break;
      case 'focus':
        response = await handleFocus(null);
        break;
      case 'unknown':
      default:
        response = await handleUnknown(rawText);
        break;
    }

    await client.chat.postMessage({
      channel:   messageEvent.channel,
      thread_ts,
      text:      response.text,
      blocks:    response.blocks,
    });
  } catch (error) {
    logger.error('[Messages] Failed to process DM:', error);
    await client.chat.postMessage({
      channel:  messageEvent.channel,
      thread_ts,
      text: `⚠️ Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
