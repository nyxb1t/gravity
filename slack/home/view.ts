/**
 * @file slack/home/view.ts
 * @description Pure Block Kit composition for the Gravity App Home Tab.
 *
 * This module assembles a `HomeView` payload from reusable block builders.
 * It performs no I/O — callers (publisher, tests) supply `HomeViewData` and
 * receive a ready-to-publish view object.
 */

import type { HomeView } from "@slack/bolt";
import type { KnownBlock } from "@/slack/blocks";
import {
  buildHeaderBlock,
  buildDividerBlock,
  buildSectionBlock,
  buildPriorityCard,
  buildChannelCard,
  buildPersonCard,
  buildAlertCard,
  buildEmptyState,
} from "@/slack/blocks";
import type {
  PriorityCardInput,
  ChannelCardInput,
  PersonCardInput,
  AlertCardInput,
} from "@/slack/blocks";

// ---------------------------------------------------------------------------
// Data contract (temporary — replaced by /api/gravity response mapping)
// ---------------------------------------------------------------------------

export interface HomeViewData {
  /** Page header shown at the top of the Home Tab. */
  header: {
    title: string;
    subtitle?: string;
    emoji?: string;
  };

  /** Priority items for the "Today's Focus" section. Empty → empty state. */
  priorities: PriorityCardInput[];

  /** Active channels, repos, or workspaces to surface. */
  channels: ChannelCardInput[];

  /** Collaborators shown in the "Key Collaborators" section. */
  collaborators: PersonCardInput[];

  /** System or integration alerts for the "Recent Alerts" section. */
  alerts: AlertCardInput[];
}

/**
 * Temporary mock payload for local development and manual testing.
 * A future data-fetch layer will map `/api/gravity` responses into
 * `HomeViewData` before calling `buildHomeView`.
 */
export const MOCK_HOME_VIEW_DATA: HomeViewData = {
  header: {
    title: "Gravity — Your Workspace Digest",
    subtitle: "Showing 4 priority items · Last synced 2 min ago",
  },
  priorities: [
    {
      id: "github:org-gravity:pr-42",
      title: "PR: Fix auth timeout in production",
      url: "https://github.com/org/gravity/pull/42",
      body: "The token refresh logic fails when network latency exceeds 5 s…",
      source: "github",
      urgency: "critical",
      author: "alice",
      channel: "org/gravity",
      timestamp: "2 min ago",
    },
    {
      id: "slack:C01:1718000000.000100",
      title: "Thread: On-call handoff notes",
      url: "https://myteam.slack.com/archives/C01/p1718000000000100",
      body: "Please review the incident timeline before Friday's rotation…",
      source: "slack",
      urgency: "high",
      author: "bob",
      channel: "#engineering",
      timestamp: "18 min ago",
    },
    {
      id: "notion:page-abc123",
      title: "Design System v2 — spec review",
      url: "https://notion.so/Design-System-v2-abc123",
      body: "Updated component tokens and accessibility guidelines…",
      source: "notion",
      urgency: "medium",
      author: "carol",
      timestamp: "1 hr ago",
    },
    {
      id: "calendar:event-xyz789",
      title: "Sprint planning — 10:00 AM",
      url: "https://calendar.google.com/event?eid=xyz789",
      source: "calendar",
      urgency: "low",
      timestamp: "Today at 10:00",
    },
  ],
  channels: [
    {
      name: "engineering",
      source: "slack",
      url: "https://myteam.slack.com/channels/engineering",
      unreadCount: 3,
      lastActivityAt: "4 min ago",
    },
    {
      name: "org/gravity",
      source: "github",
      url: "https://github.com/org/gravity",
      unreadCount: 12,
      lastActivityAt: "Yesterday",
    },
    {
      name: "Design System",
      source: "notion",
      url: "https://notion.so/design-system",
      unreadCount: 0,
      lastActivityAt: "2 days ago",
      description: "Component specs and tokens",
    },
  ],
  collaborators: [
    {
      displayName: "Alice Chen",
      slackUserId: "U04ABC123",
      role: "Senior Engineer",
      team: "Engineering",
      avatarUrl: "https://avatars.slack-edge.com/2020/10/07/alice.jpg",
      connectedSources: ["slack", "github"],
      lastSeenAt: "10 min ago",
    },
    {
      displayName: "Bob Smith",
      slackUserId: "U04DEF456",
      role: "Engineering Manager",
      team: "Platform",
      connectedSources: ["slack", "github", "calendar"],
      lastSeenAt: "35 min ago",
    },
    {
      displayName: "Carol Nguyen",
      role: "Product Designer",
      team: "Design",
      connectedSources: ["slack", "notion"],
      lastSeenAt: "1 hr ago",
    },
  ],
  alerts: [
    {
      type: "warning",
      title: "GitHub token expiring soon",
      message:
        "Your GitHub connection expires in 3 days. Reconnect to avoid sync gaps.",
      action: {
        label: "Reconnect GitHub",
        actionId: "reconnect_github",
      },
      footer: "Affects GitHub PR and issue sync",
    },
    {
      type: "info",
      title: "Scheduled maintenance",
      message:
        "Gravity will be briefly unavailable on Friday at 02:00 UTC for database upgrades.",
    },
  ],
};

// ---------------------------------------------------------------------------
// View builder
// ---------------------------------------------------------------------------

/**
 * Assembles the Gravity App Home Tab from reusable Block Kit builders.
 *
 * @param data - Pre-formatted view data (typically mapped from `/api/gravity`).
 * @returns A Slack `HomeView` ready for `views.publish`.
 */
export function buildHomeView(data: HomeViewData): HomeView {
  const blocks: KnownBlock[] = [
    ...buildGravityHeader(data),
    ...buildDividerBlock(),
    ...buildTodaysFocus(data.priorities),
    ...buildDividerBlock(),
    ...buildRelevantChannels(data.channels),
    ...buildDividerBlock(),
    ...buildKeyCollaborators(data.collaborators),
    ...buildDividerBlock(),
    ...buildRecentAlerts(data.alerts),
  ];

  return { type: "home", blocks };
}

// ---------------------------------------------------------------------------
// Section composers (private)
// ---------------------------------------------------------------------------

function buildGravityHeader(data: HomeViewData): KnownBlock[] {
  return buildHeaderBlock({
    title: data.header.title,
    subtitle: data.header.subtitle,
    emoji: data.header.emoji,
  });
}

function buildTodaysFocus(priorities: PriorityCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionBlock({ text: "*Today's Focus*" }),
  ];

  if (priorities.length === 0) {
    blocks.push(
      ...buildEmptyState({
        title: "You're all caught up!",
        message: "No priority items need your attention right now.",
        hint: "Check back later or adjust your priority filters.",
      })
    );
    return blocks;
  }

  for (const [index, item] of priorities.entries()) {
    blocks.push(...buildPriorityCard(item));
    if (index < priorities.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  return blocks;
}

function buildRelevantChannels(channels: ChannelCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionBlock({ text: "*Relevant Channels*" }),
  ];

  if (channels.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No relevant channels right now._",
      })
    );
    return blocks;
  }

  for (const [index, channel] of channels.entries()) {
    blocks.push(...buildChannelCard(channel));
    if (index < channels.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  return blocks;
}

function buildKeyCollaborators(
  collaborators: PersonCardInput[]
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionBlock({ text: "*Key Collaborators*" }),
  ];

  if (collaborators.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No collaborators to highlight right now._",
      })
    );
    return blocks;
  }

  for (const [index, person] of collaborators.entries()) {
    blocks.push(...buildPersonCard(person));
    if (index < collaborators.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  return blocks;
}

function buildRecentAlerts(alerts: AlertCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionBlock({ text: "*Recent Alerts*" }),
  ];

  if (alerts.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No recent alerts._",
      })
    );
    return blocks;
  }

  for (const [index, alert] of alerts.entries()) {
    blocks.push(...buildAlertCard(alert));
    if (index < alerts.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  return blocks;
}
