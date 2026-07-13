/**
 * @file slack/events/app-home-opened.ts
 * @description Proactive Home Tab — shows real workspace data when opened.
 *
 * When USE_LIVE_DATA=true:
 *   - Fetches from GitHub, Calendar, Notion
 *   - Runs orchestrator to rank priorities
 *   - Generates cross-source insights
 *   - Shows proper empty states if nothing found
 *   - NEVER falls back to mock data
 *
 * When USE_LIVE_DATA=false:
 *   - Returns mock data (development only)
 */

import type { EventArgs } from '@/slack/types';
import type { DetectedConflict } from '@/ai/conflicts';
import { publishHomeView } from '@/slack/home/publisher';
import type { HomeViewData } from '@/slack/home/view';
import { getWorkspaceData, logStartupConfig } from '@/integrations/live';
import { runOrchestrator } from '@/ai/engine';
import { formatRelativeTime } from '@/slack/utils';
import type { WorkspaceItem } from '@/types';

// ---------------------------------------------------------------------------
// Empty state (used when live mode has no data)
// ---------------------------------------------------------------------------

function buildEmptyHomeViewData(displayName: string): HomeViewData {
  return {
    header: {
      title:    'Gravity — Your Workspace Digest',
      subtitle: 'Live mode active · No items found',
    },
    priorities:    [],
    channels:      [],
    collaborators: [],
    alerts:        [],
    meetings:      [],
    insights:      [
      {
        id:      'calm',
        kind:    'positive',
        message: '🎉 Everything looks clear right now. Your workspace is calm.',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cross-source reasoning: generate AI insights from live data
// ---------------------------------------------------------------------------

function generateInsights(
  githubItems: WorkspaceItem[],
  calendarItems: WorkspaceItem[],
  notionItems: WorkspaceItem[]
): HomeViewData['insights'] {
  const insights: HomeViewData['insights'] = [];

  // Check for blockers in GitHub
  const blockers = githubItems.filter((i) =>
    i.tags?.some((t) => ['blocker', 'blocked', 'bug', 'critical'].includes(t.toLowerCase()))
  );
  if (blockers.length > 0) {
    insights.push({
      id:      'github-blockers',
      kind:    'blocker',
      message: `⚠️ ${blockers.length} GitHub item${blockers.length !== 1 ? 's are' : ' is'} marked as blocker/critical: "${blockers[0].title}"${blockers.length > 1 ? ` and ${blockers.length - 1} more` : ''}`,
    });
  }

  // Check for upcoming meetings (within next 2 hours)
  const nowMs     = Date.now();
  const twoHours  = 2 * 60 * 60 * 1000;
  const imminent  = calendarItems.filter((i) => {
    const start = i.metadata?.startTime ? new Date(i.metadata.startTime as string).getTime() : null;
    return start && start > nowMs && start - nowMs <= twoHours;
  });
  if (imminent.length > 0) {
    const mins = Math.round((new Date((imminent[0].metadata!.startTime as string)).getTime() - nowMs) / 60000);
    insights.push({
      id:      'imminent-meeting',
      kind:    'reminder',
      message: `📅 "${imminent[0].title}" starts in ${mins} minute${mins !== 1 ? 's' : ''}`,
    });
  }

  // PRs awaiting review
  const prsForReview = githubItems.filter((i) => i.kind === 'pr_review');
  if (prsForReview.length > 0) {
    insights.push({
      id:      'prs-review',
      kind:    'attention',
      message: `🔀 ${prsForReview.length} pull request${prsForReview.length !== 1 ? 's' : ''} open in GitHub`,
    });
  }

  // Notion pending docs
  if (notionItems.length > 0) {
    insights.push({
      id:      'notion-pending',
      kind:    'reminder',
      message: `📝 ${notionItems.length} Notion page${notionItems.length !== 1 ? 's' : ''} in progress`,
    });
  }

  // Cross-source: open blocker issue + upcoming meeting = sprint risk
  if (blockers.length > 0 && calendarItems.length > 0) {
    insights.push({
      id:      'sprint-risk',
      kind:    'blocker',
      message: `🚨 Sprint risk: "${blockers[0].title}" is unresolved and you have ${calendarItems.length} meeting${calendarItems.length !== 1 ? 's' : ''} scheduled`,
    });
  }

  return insights.slice(0, 5); // Cap at 5 insights
}

// ---------------------------------------------------------------------------
// Build live HomeViewData
// ---------------------------------------------------------------------------

async function loadLiveHomeViewData(displayName: string): Promise<HomeViewData> {
  console.log(`[HomeTab] Loading live data for ${displayName}…`);

  const { items, userContext, sources } = await getWorkspaceData();

  console.log(`[HomeTab] Fetched ${items.length} total items (GitHub: ${sources.github}, Calendar: ${sources.calendar}, Notion: ${sources.notion})`);

  if (items.length === 0) {
    console.log('[HomeTab] No items found — showing empty state');
    return buildEmptyHomeViewData(displayName);
  }

  // Run orchestrator for ranked priorities
  console.log('[HomeTab] Running orchestrator…');
  const orchestratorResult = await runOrchestrator({
    items,
    context: userContext,
    mode:    'lens',
    options: { topN: 5, debug: false },
  });
  console.log(`[HomeTab] Generated ${orchestratorResult.rankedItems.length} priorities`);

  // Map ranked items → priorities
  const priorities = orchestratorResult.rankedItems.slice(0, 5).map((ranked) => ({
    id:        ranked.item.raw.id,
    title:     ranked.item.raw.title,
    url:       ranked.item.raw.url,
    body:      ranked.item.raw.body,
    source:    ranked.item.raw.source,
    urgency:   ranked.score.urgency,
    author:    ranked.item.raw.author?.displayName,
    channel:   ranked.item.raw.channel,
    timestamp: ranked.item.raw.createdAt
      ? formatRelativeTime(ranked.item.raw.createdAt)
      : undefined,
  }));

  // Map conflicts → alerts
  const alerts = orchestratorResult.conflictResult.conflicts
    .slice(0, 3)
    .map((conflict) => {
      const dc = conflict as DetectedConflict;
      return {
        type: (dc.severity === 'critical'
          ? 'error'
          : dc.severity === 'high'
          ? 'warning'
          : 'info') as 'error' | 'warning' | 'info',
        title:   dc.description,
        message: dc.explanation ?? dc.description,
        footer:  dc.detectedAt
          ? `Detected at ${new Date(dc.detectedAt).toLocaleTimeString()}`
          : undefined,
      };
    });

  // Separate calendar items → meetings
  const calendarRaw = items.filter((i) => i.raw.source === 'calendar').map((i) => i.raw);
  const meetings = calendarRaw.slice(0, 3).map((event) => {
    const startTime = event.metadata?.startTime
      ? new Date(event.metadata.startTime as string).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : 'TBD';
    const endTime = event.metadata?.endTime
      ? new Date(event.metadata.endTime as string).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : '';
    return {
      id:        event.id,
      title:     event.title,
      time:      endTime ? `${startTime} – ${endTime}` : startTime,
      attendees: event.participants?.map((p) => p.displayName).filter(Boolean) ?? [],
      joinUrl:   event.url ?? '',
    };
  });

  // Generate cross-source AI insights
  const githubRaw   = items.filter((i) => i.raw.source === 'github').map((i) => i.raw);
  const notionRaw   = items.filter((i) => i.raw.source === 'notion').map((i) => i.raw);
  const insights    = generateInsights(githubRaw, calendarRaw, notionRaw);

  if (insights.length === 0 && priorities.length === 0) {
    insights.push({
      id:      'calm',
      kind:    'positive',
      message: '🎉 Everything looks clear right now. Your workspace is calm.',
    });
  }

  const sourceList = [
    sources.github   > 0 ? `${sources.github} GitHub` : null,
    sources.calendar > 0 ? `${sources.calendar} Calendar` : null,
    sources.notion   > 0 ? `${sources.notion} Notion` : null,
  ].filter(Boolean).join(' · ');

  return {
    header: {
      title:    'Gravity — Your Workspace Digest',
      subtitle: `${priorities.length} priority item${priorities.length !== 1 ? 's' : ''} · Live data (${sourceList || 'no sources'}) · Last synced just now`,
    },
    priorities,
    channels:      [],
    collaborators: [],
    alerts,
    meetings,
    insights,
  };
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

export async function onAppHomeOpened({
  event,
  client,
}: EventArgs<'app_home_opened'>): Promise<void> {
  if (event.tab !== 'home') return;

  console.log(`[HomeTab] app_home_opened for user ${event.user}`);

  // Log startup config once
  logStartupConfig();

  const useLive = process.env.USE_LIVE_DATA === 'true';

  // Resolve real display name from Slack
  let displayName = 'there';
  try {
    const userInfo = await client.users.info({ user: event.user });
    displayName = (userInfo.user as any)?.profile?.display_name
      || (userInfo.user as any)?.real_name
      || (userInfo.user as any)?.name
      || 'there';
    console.log(`[HomeTab] Resolved display name: "${displayName}"`);
  } catch (err) {
    console.warn('[HomeTab] Could not resolve user display name:', err);
  }

  let data: HomeViewData;

  if (!useLive) {
    // Mock mode — development only
    const { MOCK_HOME_VIEW_DATA } = await import('@/slack/home/view');
    data = MOCK_HOME_VIEW_DATA;
  } else {
    try {
      data = await loadLiveHomeViewData(displayName);
    } catch (err) {
      console.error('[HomeTab] ❌ Failed to load live data:', err);
      // Do NOT fall back to mock — show empty state instead
      data = buildEmptyHomeViewData(displayName);
      data.alerts.push({
        type:    'warning',
        title:   'Workspace data unavailable',
        message: `Could not fetch live data: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  console.log(`[HomeTab] Publishing view with ${data.priorities.length} priorities, ${data.meetings.length} meetings, ${data.insights.length} insights`);
  await publishHomeView(event.user, data, displayName);
}
