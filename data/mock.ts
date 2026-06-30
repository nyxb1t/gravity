/**
 * @file data/mock.ts
 * @description Realistic mock workspace data for Gravity.
 *
 * Simulates a set of WorkspaceItems, UserContext, and Conflicts for a fictional
 * project "Feature X" (a Real-Time Collaborative Canvas). The timestamps are
 * calculated dynamically relative to a provided reference time (defaulting to
 * the current time) so that recency and deadline urgency scoring remain active
 * and realistic whenever the ranking engine is run.
 */

import type { NormalizedItem, UserContext, Conflict, WorkspaceItem } from "@/types";

/**
 * Mock User Context for the target user: Alex Chen.
 * Alex is a Lead Engineer working on the Feature X collaborative canvas.
 */
export const MOCK_USER_CONTEXT: UserContext = {
  userId: "user_alex_chen",
  displayName: "Alex Chen",
  email: "alex.chen@company.com",
  locale: "en",
  timezone: "America/Los_Angeles",
  connectedAccounts: {
    slack: "U01AM3K8S",
    github: "alexchen-dev",
    notion: "alex-notion-uuid",
    calendar: "alex.chen@company.com",
  },
  roles: ["engineering", "team-lead", "backend"],
  quietHours: {
    start: "22:00",
    end: "08:00",
  },
  prioritySources: [
    "Feature X",
    "github:company/feature-x-repo",
    "slack:feature-x-team",
    "slack:feature-x-alerts",
  ],
  mutedSources: [
    "slack:random",
    "slack:general",
  ],
};

/**
 * Generates a set of mock workspace items, conflicts, and user context.
 *
 * @param now - The reference "current" time. Defaults to `new Date()`.
 */
export function getMockData(now: Date = new Date()) {
  const nowMs = now.getTime();

  // Helper to create relative ISO strings
  const relativeTime = (offsetMs: number): string => {
    return new Date(nowMs + offsetMs).toISOString();
  };

  // ---------------------------------------------------------------------------
  // 1. Raw Workspace Items
  // ---------------------------------------------------------------------------

  // --- SLACK MESSAGES ---

  const slackBlockerMsg: WorkspaceItem = {
    id: "slack:C01234567:1718000000.000100",
    source: "slack",
    kind: "message",
    title: "Critical WebSocket buffer overflow blocking QA load tests",
    body: "Hey @Alex Chen, the WebSocket connection drops under high load (100+ concurrent users). The buffer overflows and it's blocking the QA team from doing the Feature X load tests. Dave is investigating but we need your eyes on the Redis adapter.",
    createdAt: relativeTime(-15 * 60 * 1000), // 15 mins ago
    url: "https://slack.com/archives/C01234567/p1718000000000100",
    author: {
      id: "U01PM_SARAH",
      displayName: "Sarah Jenkins",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    },
    participants: [
      { id: "U01AM3K8S", displayName: "Alex Chen", role: "assignee" },
      { id: "U01ENG_DAVE", displayName: "Dave Miller" },
    ],
    mentionsUser: true,
    channel: "slack:feature-x-team",
    tags: ["Feature X", "blocker", "high-load"],
    metadata: {
      isBlocker: true,
      threadEngagement: 0.85,
    },
  };

  const slackUnstructuredMentionMsg: WorkspaceItem = {
    id: "slack:C01234567:1718000000.000200",
    source: "slack",
    kind: "message",
    title: "Dave Miller uploaded canvas performance profiles",
    body: "I've uploaded the performance profiles for Feature X. Alex Chen, it looks like the serialization of canvas paths is the bottleneck. The JSON payload is too large. I've started a thread here to discuss.",
    createdAt: relativeTime(-45 * 60 * 1000), // 45 mins ago
    url: "https://slack.com/archives/C01234567/p1718000000000200",
    author: {
      id: "U01ENG_DAVE",
      displayName: "Dave Miller",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dave",
    },
    participants: [
      { id: "U01AM3K8S", displayName: "Alex Chen" },
    ],
    mentionsUser: false, // Unstructured mention in the text body
    channel: "slack:feature-x-team",
    tags: ["Feature X", "performance"],
    metadata: {
      threadEngagement: 0.4,
    },
  };

  const slackMutedMsg: WorkspaceItem = {
    id: "slack:C99999999:1718000000.000300",
    source: "slack",
    kind: "message",
    title: "Board games night organization",
    body: "Hey everyone, we're planning a board games night this Friday at 6 PM in the cafeteria. Let me know if you want to join!",
    createdAt: relativeTime(-3 * 60 * 60 * 1000), // 3 hours ago
    url: "https://slack.com/archives/C99999999/p1718000000000300",
    author: {
      id: "U02RANDOM_JOHN",
      displayName: "John Doe",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    },
    participants: [],
    mentionsUser: false,
    channel: "slack:random",
    tags: ["social", "games"],
    metadata: {},
  };

  // --- GITHUB ISSUES ---

  const githubBlockerIssue: WorkspaceItem = {
    id: "github:company/feature-x-repo:issue:245",
    source: "github",
    kind: "issue",
    title: "[Feature X] Bug: Canvas websocket connection crash under load",
    body: "The websocket server crashes with a heap out of memory error when more than 100 clients connect and draw simultaneously. This is blocking the staging deployment. Logs show the Redis pub/sub queue backing up. We need this resolved before the demo tomorrow.",
    createdAt: relativeTime(-2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: relativeTime(-1 * 60 * 60 * 1000), // 1 hour ago
    url: "https://github.com/company/feature-x-repo/issues/245",
    author: {
      id: "github:dave-frontend",
      displayName: "Dave Miller",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dave",
    },
    participants: [
      { id: "alexchen-dev", displayName: "Alex Chen", role: "assignee" },
      { id: "github:dave-frontend", displayName: "Dave Miller", role: "participant" },
    ],
    mentionsUser: true,
    channel: "github:company/feature-x-repo",
    tags: ["bug", "blocker", "Feature X"],
    metadata: {
      isBlocker: true,
      dueDate: relativeTime(10 * 60 * 60 * 1000), // Due in 10 hours
    },
  };

  const githubLowIssue: WorkspaceItem = {
    id: "github:company/feature-x-repo:issue:246",
    source: "github",
    kind: "issue",
    title: "[Feature X] Enhancement: Add custom color palette selector to canvas",
    body: "Users should be able to save their favorite colors. This is a nice-to-have for post-launch and doesn't block the core MVP demo.",
    createdAt: relativeTime(-24 * 60 * 60 * 1000), // 1 day ago
    url: "https://github.com/company/feature-x-repo/issues/246",
    author: {
      id: "github:sarah-pm",
      displayName: "Sarah Jenkins",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    },
    participants: [],
    mentionsUser: false,
    channel: "github:company/feature-x-repo",
    tags: ["enhancement", "Feature X"],
    metadata: {
      isBlocker: false,
    },
  };

  // --- GITHUB PRs ---

  const githubPrReview: WorkspaceItem = {
    id: "github:company/feature-x-repo:pr:250",
    source: "github",
    kind: "pr_review",
    title: "PR #250: Implement binary serialization for canvas path data",
    body: "This PR switches the WebSocket payload from JSON to Protocol Buffers, reducing payload size by 75% and fixing the serialization bottleneck. Needs review from @alexchen-dev to merge.",
    createdAt: relativeTime(-4 * 60 * 60 * 1000), // 4 hours ago
    updatedAt: relativeTime(-2 * 60 * 60 * 1000), // 2 hours ago
    url: "https://github.com/company/feature-x-repo/pull/250",
    author: {
      id: "github:dave-frontend",
      displayName: "Dave Miller",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dave",
    },
    participants: [
      { id: "alexchen-dev", displayName: "Alex Chen", role: "reviewer" },
      { id: "github:dave-frontend", displayName: "Dave Miller", role: "assignee" },
    ],
    mentionsUser: true,
    channel: "github:company/feature-x-repo",
    tags: ["performance", "Feature X", "review-requested"],
    metadata: {
      isBlocked: true, // Blocked by websocket crash issue
      dueDate: relativeTime(5 * 60 * 60 * 1000), // Due in 5 hours (before code freeze)
    },
  };

  const githubPrUserBlocked: WorkspaceItem = {
    id: "github:company/feature-x-repo:pr:240",
    source: "github",
    kind: "pr_review",
    title: "PR #240: Integrate Redis Adapter for horizontal scaling of WebSocket servers",
    body: "Setting up Redis adapter for Socket.io to allow multiple server instances. Ready for review. This is currently blocked by the WebSocket connection crash issue (#245).",
    createdAt: relativeTime(-5 * 60 * 60 * 1000), // 5 hours ago
    url: "https://github.com/company/feature-x-repo/pull/240",
    author: {
      id: "alexchen-dev",
      displayName: "Alex Chen",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    },
    participants: [
      { id: "alexchen-dev", displayName: "Alex Chen", role: "assignee" },
      { id: "github:sarah-pm", displayName: "Sarah Jenkins", role: "reviewer" },
    ],
    mentionsUser: false,
    channel: "github:company/feature-x-repo",
    tags: ["backend", "Feature X"],
    metadata: {
      isBlocked: true, // Marked as blocked by the bug
    },
  };

  // --- NOTION APPROVALS ---

  const notionApproval: WorkspaceItem = {
    id: "notion:page:feature-x-spec",
    source: "notion",
    kind: "page_edit",
    title: "Feature X: Technical Specification & Database Schema",
    body: "Drafting the schema for storing canvas state. We need to decide between Postgres JSONB or a binary blob store. @Alex Chen please review the schema comparison and approve the final architecture so we can begin database migration.",
    createdAt: relativeTime(-6 * 60 * 60 * 1000), // 6 hours ago
    updatedAt: relativeTime(-2 * 60 * 60 * 1000), // 2 hours ago
    url: "https://notion.so/company/specs/feature-x-spec",
    author: {
      id: "notion:sarah-pm",
      displayName: "Sarah Jenkins",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    },
    participants: [
      { id: "alex-notion-uuid", displayName: "Alex Chen", role: "reviewer" },
    ],
    mentionsUser: true,
    channel: "notion:/engineering/specs",
    tags: ["architecture", "Feature X", "approval-required"],
    metadata: {
      dueDate: relativeTime(2 * 60 * 60 * 1000), // Due in 2 hours (extremely urgent!)
    },
  };

  // --- CALENDAR EVENTS ---

  const calendarEmergencySync: WorkspaceItem = {
    id: "calendar:event:emergency-sync",
    source: "calendar",
    kind: "event",
    title: "Feature X: Emergency Blocker Sync (WebSockets)",
    body: "Urgent alignment on the websocket memory leak and Redis pub/sub queue backup. Dave and Alex to attend and align on the fix before code freeze.",
    createdAt: relativeTime(-1 * 60 * 60 * 1000), // 1 hour ago
    url: "https://calendar.google.com/event?id=emergencysync",
    author: {
      id: "calendar:dave-frontend",
      displayName: "Dave Miller",
    },
    participants: [
      { id: "alex.chen@company.com", displayName: "Alex Chen", role: "attendee" },
      { id: "calendar:dave-frontend", displayName: "Dave Miller", role: "attendee" },
      { id: "calendar:sarah-pm", displayName: "Sarah Jenkins", role: "attendee" },
    ],
    mentionsUser: false,
    channel: "calendar:alex.chen@company.com",
    tags: ["meeting", "Feature X"],
    metadata: {
      eventStart: relativeTime(30 * 60 * 1000), // Starts in 30 mins
      eventEnd: relativeTime(60 * 60 * 1000),   // Ends in 1 hour
      dueDate: relativeTime(60 * 60 * 1000),
    },
  };

  const calendarAllHands: WorkspaceItem = {
    id: "calendar:event:all-hands",
    source: "calendar",
    kind: "event",
    title: "Company All-Hands Q3 Kickoff",
    body: "Quarterly update from the leadership team. Attendance is highly encouraged for all staff.",
    createdAt: relativeTime(-3 * 24 * 60 * 60 * 1000), // 3 days ago
    url: "https://calendar.google.com/event?id=allhands",
    author: null, // Automated system invite
    participants: [
      { id: "alex.chen@company.com", displayName: "Alex Chen", role: "attendee" },
    ],
    mentionsUser: false,
    channel: "calendar:alex.chen@company.com",
    tags: ["meeting", "all-hands"],
    metadata: {
      eventStart: relativeTime(15 * 60 * 1000), // Starts in 15 mins
      eventEnd: relativeTime(75 * 60 * 1000),   // Ends in 1 hour 15 mins (Overlaps!)
      dueDate: relativeTime(75 * 60 * 1000),
    },
  };

  const calendarCodeFreeze: WorkspaceItem = {
    id: "calendar:event:code-freeze",
    source: "calendar",
    kind: "event",
    title: "Feature X: Code Freeze & Staging Deployment",
    body: "All PRs for the canvas demo must be merged and deployed to staging. No more changes after this.",
    createdAt: relativeTime(-5 * 24 * 60 * 60 * 1000), // 5 days ago
    url: "https://calendar.google.com/event?id=codefreeze",
    author: {
      id: "calendar:sarah-pm",
      displayName: "Sarah Jenkins",
    },
    participants: [
      { id: "alex.chen@company.com", displayName: "Alex Chen", role: "attendee" },
    ],
    mentionsUser: false,
    channel: "calendar:alex.chen@company.com",
    tags: ["deadline", "Feature X"],
    metadata: {
      eventStart: relativeTime(4 * 60 * 60 * 1000), // 4 hours from now
      eventEnd: relativeTime(4.5 * 60 * 60 * 1000),
      dueDate: relativeTime(4 * 60 * 60 * 1000),   // Deadline is at event start
    },
  };

  const allRawItems = [
    slackBlockerMsg,
    slackUnstructuredMentionMsg,
    slackMutedMsg,
    githubBlockerIssue,
    githubLowIssue,
    githubPrReview,
    githubPrUserBlocked,
    notionApproval,
    calendarEmergencySync,
    calendarAllHands,
    calendarCodeFreeze,
  ];

  // ---------------------------------------------------------------------------
  // 2. Conflicts
  // ---------------------------------------------------------------------------

  // Conflict 1: Overlapping Calendar Events
  const scheduleConflict: Conflict = {
    id: "conflict:overlap-meetings",
    type: "schedule",
    items: [calendarEmergencySync, calendarAllHands],
    description: "Double-booked: 'Feature X: Emergency Blocker Sync (WebSockets)' overlaps with 'Company All-Hands Q3 Kickoff' between 15 mins and 60 mins from now.",
    severity: "critical",
    detectedAt: relativeTime(-10 * 60 * 1000), // Detected 10 mins ago
    acknowledged: false,
  };

  // Conflict 2: User's PR is blocked by a blocker bug issue
  const dependencyConflict: Conflict = {
    id: "conflict:pr-blocked-by-bug",
    type: "dependency",
    items: [githubPrUserBlocked, githubBlockerIssue],
    description: "Your PR #240 'Integrate Redis Adapter' is blocked by unresolved blocker issue #245 '[Feature X] Bug: Canvas websocket connection crash under load'.",
    severity: "high",
    detectedAt: relativeTime(-1 * 60 * 60 * 1000), // Detected 1 hour ago
    acknowledged: false,
  };

  // Conflict 3: Dave's PR #250 is blocked by the blocker bug issue #245
  const prDependencyConflict: Conflict = {
    id: "conflict:review-pr-blocked-by-bug",
    type: "dependency",
    items: [githubPrReview, githubBlockerIssue],
    description: "PR #250 'Implement binary serialization' requires review but is blocked by unresolved blocker issue #245.",
    severity: "medium",
    detectedAt: relativeTime(-2 * 60 * 60 * 1000), // Detected 2 hours ago
    acknowledged: false,
  };

  const allConflicts = [
    scheduleConflict,
    dependencyConflict,
    prDependencyConflict,
  ];

  // Helper to find conflicts associated with a specific item
  const getConflictsForItem = (itemId: string): Conflict[] => {
    return allConflicts.filter((conflict) =>
      conflict.items.some((item) => item.id === itemId)
    );
  };

  // ---------------------------------------------------------------------------
  // 3. Normalized Items
  // ---------------------------------------------------------------------------

  const normalizedItems: NormalizedItem[] = allRawItems.map((raw) => {
    const conflicts = getConflictsForItem(raw.id);

    // Make some items already read or bookmarked for realism
    const isRead = raw.id === slackMutedMsg.id || raw.id === githubLowIssue.id;
    const isBookmarked = raw.id === notionApproval.id;

    return {
      raw,
      conflicts,
      isRead,
      isBookmarked,
      firstSeenAt: isRead ? relativeTime(-30 * 60 * 1000) : null,
      lastProcessedAt: relativeTime(-5 * 60 * 1000), // Processed 5 mins ago
      // Note: score remains undefined until computed by the ranking engine.
    };
  });

  return {
    userContext: MOCK_USER_CONTEXT,
    items: normalizedItems,
    conflicts: allConflicts,
  };
}

// ---------------------------------------------------------------------------
// Static Exports (initialized relative to when the module is imported)
// ---------------------------------------------------------------------------

const staticData = getMockData();

export const MOCK_NORMALIZED_ITEMS: NormalizedItem[] = staticData.items;
export const MOCK_CONFLICTS: Conflict[] = staticData.conflicts;
