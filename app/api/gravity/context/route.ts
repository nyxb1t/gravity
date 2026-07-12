import { NextResponse } from 'next/server';
import type { UnifiedWorkspaceContext, WorkspaceItem } from '@/types';

export async function GET(request: Request) {

  // ── LIVE MODE ─────────────────────────────────────────────────────────────
  if (process.env.USE_LIVE_DATA === 'true') {
    const { fetchGitHubData }   = await import('@/integrations/github/client');
    const { fetchCalendarData } = await import('@/integrations/calendar/client');
    const { fetchNotionData }   = await import('@/integrations/notion/client');

    let githubItems: WorkspaceItem[]   = [];
    let calendarItems: WorkspaceItem[] = [];
    let notionItems: WorkspaceItem[]= [];

    try { githubItems   = await fetchGitHubData();   } catch (err) { console.error('GitHub failed:', err); }
    try { calendarItems = await fetchCalendarData(); } catch (err) { console.error('Calendar failed:', err); }
    try { notionItems   = await fetchNotionData();   } catch (err) { console.error('Notion failed:', err); }
  

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      items: [...githubItems, ...calendarItems, ...notionItems]
    });
  }

  // ── MOCK MODE (default) ───────────────────────────────────────────────────
  const mockContext: UnifiedWorkspaceContext = {
    timestamp: new Date().toISOString(),
    items: [
      {
        id: 'github-101',
        source: 'github',
        kind: 'issue',
        title: 'Critical auth bypass in login handler',
        body: 'Auth bypass found in the login handler — allows unauthenticated access to protected endpoints.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://github.com/org/repo/issues/101',
        author: { id: 'jane_doe', displayName: 'Jane Doe' },
        participants: [{ id: 'jane_doe', displayName: 'Jane Doe', role: 'assignee' }],
        mentionsUser: false,
        tags: ['bug', 'critical'],
        metadata: { isCritical: true },
      },
      {
        id: 'github-202',
        source: 'github',
        kind: 'pr_review',
        title: 'Refactor auth middleware to use JWT',
        body: 'Replaces session-based auth with stateless JWT tokens across all API routes.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://github.com/org/repo/pull/202',
        author: { id: 'bob_pm', displayName: 'Bob PM' },
        participants: [{ id: 'bob_pm', displayName: 'Bob PM', role: 'assignee' }],
        mentionsUser: false,
        tags: ['review-needed'],
        metadata: { isCritical: false },
      },
      {
        id: 'notion-303',
        source: 'notion',
        kind: 'page_edit',
        title: 'Sign-off on Q3 Architecture Roadmap',
        body: 'Pending approval from engineering leads before the Q3 planning kickoff.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://notion.so/org/q3-roadmap',
        author: { id: 'bob_pm', displayName: 'Bob PM' },
        participants: [{ id: 'bob_pm', displayName: 'Bob PM', role: 'assignee' }],
        mentionsUser: false,
        channel: 'Core Infrastructure',
        tags: ['pending_approval'],
        metadata: { parentProject: 'Core Infrastructure' },
      },
      {
        id: 'notion-404',
        source: 'notion',
        kind: 'page_edit',
        title: 'Design system component audit',
        body: 'Audit of all design system components for accessibility and visual consistency.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://notion.so/org/design-audit',
        author: { id: 'sara_design', displayName: 'Sara Design' },
        participants: [{ id: 'sara_design', displayName: 'Sara Design', role: 'assignee' }],
        mentionsUser: false,
        channel: 'Design System v2',
        tags: ['blocked'],
        metadata: { parentProject: 'Design System v2' },
      },
      {
        id: 'calendar-505',
        source: 'calendar',
        kind: 'event',
        title: 'Urgent QA Defect Review Sync',
        body: 'Emergency sync to triage critical defects found during the QA load test run.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://calendar.google.com/event?id=505',
        author: null,
        participants: [
          { id: 'jane_doe', displayName: 'Jane Doe', role: 'attendee' },
          { id: 'qa_team', displayName: 'QA Team', role: 'attendee' },
        ],
        mentionsUser: false,
        tags: [],
        metadata: {
          startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        },
      },
      {
        id: 'calendar-606',
        source: 'calendar',
        kind: 'event',
        title: 'Sprint 12 Deadline',
        body: 'All Sprint 12 deliverables must be merged and deployed by end of this event.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://calendar.google.com/event?id=606',
        author: null,
        participants: [
          { id: 'jane_doe', displayName: 'Jane Doe', role: 'attendee' },
          { id: 'bob_pm', displayName: 'Bob PM', role: 'attendee' },
          { id: 'sara_design', displayName: 'Sara Design', role: 'attendee' },
        ],
        mentionsUser: false,
        tags: [],
        metadata: {
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        },
      },
    ]
  };

  return NextResponse.json(mockContext);
}