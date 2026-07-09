/**
 * @file slack/home/view.ts
 * @description Pure Block Kit composition for the Gravity App Home Tab.
 *
 * This module assembles a `HomeView` payload from reusable block builders.
 * It performs no I/O â€” callers (publisher, tests) supply `HomeViewData` and
 * receive a ready-to-publish view object.
 */

import type { View } from "@slack/types";
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
// Data contract (temporary â€” replaced by /api/gravity response mapping)
// ---------------------------------------------------------------------------
export interface MeetingCardInput {
  id: string;
  title: string;
  time: string;
  attendees: string[];
  joinUrl: string;
}

export interface InsightCardInput {
  id: string;
  message: string;
  kind: "attention" | "reminder" | "blocker" | "positive";
  actionUrl?: string;
}

export interface HomeViewData {
  /** Page header shown at the top of the Home Tab. */
  header: {
    title: string;
    subtitle?: string;
    emoji?: string;
  };

  /** Priority items for the "Today's Focus" section. Empty â†’ empty state. */
  priorities: PriorityCardInput[];

  /** Active channels, repos, or workspaces to surface. */
  channels: ChannelCardInput[];

  /** Collaborators shown in the "Key Collaborators" section. */
  collaborators: PersonCardInput[];

  /** System or integration alerts for the "Recent Alerts" section. */
  alerts: AlertCardInput[];

  meetings: MeetingCardInput[];
  insights: InsightCardInput[];
}

/**
 * Temporary mock payload for local development and manual testing.
 * A future data-fetch layer will map `/api/gravity` responses into
 * `HomeViewData` before calling `buildHomeView`.
 */
export const MOCK_HOME_VIEW_DATA: HomeViewData = {
  header: {
    title: "Gravity â€” Your Workspace Digest",
    subtitle: "Showing 4 priority items Â· Last synced 2 min ago",
  },
  priorities: [
    {
      id: "github:org-gravity:pr-42",
      title: "PR: Fix auth timeout in production",
      url: "https://github.com/org/gravity/pull/42",
      body: "The token refresh logic fails when network latency exceeds 5 sâ€¦",
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
      body: "Please review the incident timeline before Friday's rotationâ€¦",
      source: "slack",
      urgency: "high",
      author: "bob",
      channel: "#engineering",
      timestamp: "18 min ago",
    },
    {
      id: "notion:page-abc123",
      title: "Design System v2 â€” spec review",
      url: "https://notion.so/Design-System-v2-abc123",
      body: "Updated component tokens and accessibility guidelinesâ€¦",
      source: "notion",
      urgency: "medium",
      author: "carol",
      timestamp: "1 hr ago",
    },
    {
      id: "calendar:event-xyz789",
      title: "Sprint planning â€” 10:00 AM",
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
  meetings: [
  {
    id: "meeting1",
    title: "Team Sync",
    time: "5:00 PM â€“ 5:30 PM",
    attendees: ["Alice", "Bob", "Carol"],
    joinUrl: "https://meet.google.com/",
  },
],

insights: [
  {
    id: "1",
    kind: "attention",
    message: "You have 3 PRs waiting for review.",
  },
  {
    id: "2",
    kind: "blocker",
    message: "Person 1 is waiting for API documentation.",
  },
  {
    id: "3",
    kind: "reminder",
    message: "You have a meeting in 15 minutes.",
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
export function buildHomeView(data: HomeViewData): View {
  const blocks: KnownBlock[] = [
    ...buildGravityHeader(data),

    ...buildDashboardSnapshot(data),

    ...buildTodaysFocus(data.priorities),

    ...buildRecentAlerts(data.alerts),

    ...buildAiInsights(data.insights),

    ...buildUpcomingMeetings(data.meetings),

    ...buildKeyCollaborators(data.collaborators),

    ...buildRelevantChannels(data.channels),

    ...buildQuickActions(),
  ];

  return {
    type: "home",
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Section composers (private)
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();

  return hour < 12 ? "Good Morning" : "Good Evening";
}

function buildGravityHeader(_: HomeViewData): KnownBlock[] {
  return [
    ...buildHeaderBlock({
      title: `👋 ${getGreeting()}, Jacob`,
      subtitle: "Here's what needs your attention today.",
      emoji: "",
    }),
    ...buildSpacer(),
  ];
}

function buildDashboardSnapshot(data: HomeViewData): KnownBlock[] {
  const criticalTasks = data.priorities.filter(
    (item) => item.urgency !== "low"
  ).length;
  const unreadMessages = data.channels.reduce(
    (total, channel) => total + (channel.unreadCount ?? 0),
    0
  );

  return [
    ...buildSectionBlock({
      fields: [
        {
          label: "🔥 Dashboard Snapshot",
          value: `${criticalTasks} Critical Tasks`,
        },
        {
          label: "📅 Calendar",
          value: `${data.meetings.length} Meeting`,
        },
        {
          label: "💬 Workspace",
          value: `${unreadMessages} Unread Messages`,
        },
        {
          label: "🚨 Signals",
          value: `${data.alerts.length} Alerts`,
        },
      ],
    }),
    ...buildSpacer(),
  ];
}

function buildSectionHeading(
  title: string,
  description: string
): KnownBlock[] {
  return [
    ...buildDividerBlock(),
    ...buildSectionBlock({
      text:
        "━━━━━━━━━━━━━━━━━━\n" +
        `*${title}*\n` +
        `${description}\n` +
        "━━━━━━━━━━━━━━━━━━",
    }),
    ...buildSpacer(),
  ];
}

function buildSpacer(): KnownBlock[] {
  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: " ",
        },
      ],
    },
  ];
}

function buildTodaysFocus(priorities: PriorityCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "🎯 TODAY'S FOCUS",
      "Priority work requiring attention"
    ),
  ];

  if (priorities.length === 0) {
    blocks.push(
      ...buildEmptyState({
        title: "You're all caught up!",
        message: "No priority items need your attention right now.",
        hint: "Check back later or adjust your priority filters.",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (let index = 0; index < priorities.length; index++) {
    const item = priorities[index];
    blocks.push(...buildPriorityCard(item));
    if (index < priorities.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildRecentAlerts(alerts: AlertCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "🚨 RECENT ALERTS",
      "Important system and integration signals"
    ),
  ];

  if (alerts.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No recent alerts._",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (let index = 0; index < alerts.length; index++) {
    const alert = alerts[index];
    blocks.push(...buildAlertCard(alert));
    if (index < alerts.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildAiInsights(insights: InsightCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "🤖 AI INSIGHTS",
      "Patterns Gravity noticed across your workspace"
    ),
  ];

  if (insights.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No new insights right now._",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (const insight of insights) {
    blocks.push(
      ...buildSectionBlock({
        text: `• ${insight.message}`,
      })
    );
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildUpcomingMeetings(meetings: MeetingCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "📅 UPCOMING MEETINGS",
      "Calendar moments that may shape your day"
    ),
  ];

  if (meetings.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No meetings scheduled._",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (const meeting of meetings) {
    blocks.push(
      ...buildSectionBlock({
        text:
          `*${meeting.title}*\n` +
          `🕒 ${meeting.time}\n` +
          `👥 ${meeting.attendees.join(", ")}`,
      })
    );
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildKeyCollaborators(
  collaborators: PersonCardInput[]
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "👥 KEY COLLABORATORS",
      "People connected to today's highest-impact work"
    ),
  ];

  if (collaborators.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No collaborators to highlight right now._",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (let index = 0; index < collaborators.length; index++) {
    const person = collaborators[index];
    blocks.push(...buildPersonCard(person));
    if (index < collaborators.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildRelevantChannels(channels: ChannelCardInput[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    ...buildSectionHeading(
      "💬 RELEVANT CHANNELS",
      "Active spaces worth scanning next"
    ),
  ];

  if (channels.length === 0) {
    blocks.push(
      ...buildSectionBlock({
        text: "_No relevant channels right now._",
      })
    );
    blocks.push(...buildSpacer());
    return blocks;
  }

  for (let index = 0; index < channels.length; index++) {
    const channel = channels[index];
    blocks.push(...buildChannelCard(channel));
    if (index < channels.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  blocks.push(...buildSpacer());
  return blocks;
}

function buildQuickActions(): KnownBlock[] {
  return [
    ...buildSectionHeading(
      "⚡ QUICK ACTIONS",
      "Fast ways to ask Gravity for the next useful view"
    ),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Summarize My Day",
          },
          action_id: "summarize_day",
          style: "primary",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Show Unread",
          },
          action_id: "show_unread",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Pending PRs",
          },
          action_id: "pending_prs",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Calendar",
          },
          action_id: "calendar",
        },
      ],
    },
    ...buildSpacer(),
  ];
}
