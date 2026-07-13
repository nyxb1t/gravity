/**
 * @file slack/actions/quick-actions.ts
 * @description Block action handlers for Gravity Home Tab quick actions.
 *
 * Each button fetches real live data instead of returning hardcoded strings.
 */

import type { View }       from '@slack/types';
import type { ActionArgs } from '@/slack/types';

type QuickActionHandler = (args: ActionArgs) => Promise<void>;

// ---------------------------------------------------------------------------
// Modal builder helper
// ---------------------------------------------------------------------------

function buildModal(title: string, text: string): View {
  return {
    type:  'modal',
    title: { type: 'plain_text', text: title },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
  };
}

function getTriggerId(body: ActionArgs['body']): string {
  if ('trigger_id' in body && typeof body.trigger_id === 'string') {
    return body.trigger_id;
  }
  throw new Error('[quick-actions] Missing trigger_id');
}

async function openModal(args: ActionArgs, title: string, text: string): Promise<void> {
  await args.client.views.open({
    trigger_id: getTriggerId(args.body),
    view:       buildModal(title, text),
  });
}

// ---------------------------------------------------------------------------
// Summarize Day — all 3 sources
// ---------------------------------------------------------------------------

export const onSummarizeDayAction: QuickActionHandler = async (args) => {
  await args.ack();

  let text = '📋 *Today\'s Summary*\n';
  try {
    const { getWorkspaceData } = await import('@/integrations/live');
    const { items, sources }   = await getWorkspaceData();

    if (items.length === 0) {
      text += '\n🎉 Your workspace is calm — no active items found.';
    } else {
      if (sources.github   > 0) text += `\n• 🐙 *GitHub:* ${sources.github} open item${sources.github !== 1 ? 's' : ''}`;
      if (sources.calendar > 0) text += `\n• 📅 *Calendar:* ${sources.calendar} upcoming meeting${sources.calendar !== 1 ? 's' : ''}`;
      if (sources.notion   > 0) text += `\n• 📝 *Notion:* ${sources.notion} page${sources.notion !== 1 ? 's' : ''} in progress`;

      // Show top 3 items
      const top3 = items.slice(0, 3).map((i) => `• *${i.raw.title}* _(${i.raw.source})_`).join('\n');
      text += `\n\n*Top items:*\n${top3}`;

      if (items.length > 3) {
        text += `\n_...and ${items.length - 3} more. Open the Home Tab for the full view._`;
      }
    }
  } catch (err) {
    text += `\n⚠️ Could not load workspace data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  await openModal(args, "Today's Summary", text);
};

// ---------------------------------------------------------------------------
// Show Unread — GitHub open issues
// ---------------------------------------------------------------------------

export const onShowUnreadAction: QuickActionHandler = async (args) => {
  await args.ack();

  let text = '💬 *Open GitHub Issues*\n';
  try {
    const { fetchGitHubData } = await import('@/integrations/github/client');
    const items = await fetchGitHubData();
    const issues = items.filter((i) => i.kind === 'issue');

    if (issues.length === 0) {
      text += '\n✅ No open GitHub issues found.';
    } else {
      text += `\n${issues.slice(0, 5).map((i) => `• ${i.url ? `<${i.url}|${i.title}>` : `*${i.title}*`}`).join('\n')}`;
      if (issues.length > 5) text += `\n_...and ${issues.length - 5} more_`;
    }
  } catch (err) {
    text += `\n⚠️ Could not load GitHub data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  await openModal(args, 'Open Issues', text);
};

// ---------------------------------------------------------------------------
// Pending PRs — GitHub pull requests
// ---------------------------------------------------------------------------

export const onPendingPrsAction: QuickActionHandler = async (args) => {
  await args.ack();

  let text = '🔀 *Pending Pull Requests*\n';
  try {
    const { fetchGitHubData } = await import('@/integrations/github/client');
    const items = await fetchGitHubData();
    const prs   = items.filter((i) => i.kind === 'pr_review');

    if (prs.length === 0) {
      text += '\n✅ No open pull requests found.';
    } else {
      text += `\n${prs.slice(0, 5).map((p) => `• ${p.url ? `<${p.url}|${p.title}>` : `*${p.title}*`}${p.author ? ` — by ${p.author.displayName}` : ''}`).join('\n')}`;
      if (prs.length > 5) text += `\n_...and ${prs.length - 5} more_`;
    }
  } catch (err) {
    text += `\n⚠️ Could not load GitHub data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  await openModal(args, 'Pending PRs', text);
};

// ---------------------------------------------------------------------------
// Calendar — upcoming events
// ---------------------------------------------------------------------------

export const onCalendarAction: QuickActionHandler = async (args) => {
  await args.ack();

  let text = '📅 *Upcoming Calendar Events*\n';
  try {
    const { fetchCalendarData } = await import('@/integrations/calendar/client');
    const events = await fetchCalendarData();

    if (events.length === 0) {
      text += '\n✅ No upcoming meetings in the next 7 days.';
    } else {
      text += `\n${events.slice(0, 5).map((e) => {
        const start = e.metadata?.startTime
          ? new Date(e.metadata.startTime as string).toLocaleString('en-IN', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : 'Scheduled';
        return `• *${e.title}* — ${start}${e.url ? ` (<${e.url}|join>)` : ''}`;
      }).join('\n')}`;
      if (events.length > 5) text += `\n_...and ${events.length - 5} more_`;
    }
  } catch (err) {
    text += `\n⚠️ Could not load calendar data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  await openModal(args, 'Calendar', text);
};
