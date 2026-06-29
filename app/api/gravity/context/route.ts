import { NextResponse } from 'next/server';
import { UnifiedWorkspaceContext } from '@/types/normalizer';

export async function GET(request: Request) {
  const mockContext: UnifiedWorkspaceContext = {
    timestamp: new Date().toISOString(),
    items: [
      {
        id: 'github-101',
        source: 'github',
        type: 'issue',
        title: 'Critical auth bypass in login handler',
        status: 'open',
        updatedAt: new Date().toISOString(),
        url: 'https://github.com/org/repo/issues/101',
        assignees: ['jane_doe'],
        metadata: { labels: ['bug', 'critical'], isCritical: true }
      },
      {
        id: 'github-202',
        source: 'github',
        type: 'pr',
        title: 'Refactor auth middleware to use JWT',
        status: 'open',
        updatedAt: new Date().toISOString(),
        url: 'https://github.com/org/repo/pull/202',
        assignees: ['bob_pm'],
        metadata: { labels: ['review-needed'], isCritical: false }
      },
      {
        id: 'notion-303',
        source: 'notion',
        type: 'task',
        title: 'Sign-off on Q3 Architecture Roadmap',
        status: 'pending_approval',
        updatedAt: new Date().toISOString(),
        url: 'https://notion.so/org/q3-roadmap',
        assignees: ['bob_pm'],
        metadata: { parentProject: 'Core Infrastructure' }
      },
      {
        id: 'notion-404',
        source: 'notion',
        type: 'task',
        title: 'Design system component audit',
        status: 'blocked',
        updatedAt: new Date().toISOString(),
        url: 'https://notion.so/org/design-audit',
        assignees: ['sara_design'],
        metadata: { parentProject: 'Design System v2' }
      },
      {
        id: 'calendar-505',
        source: 'calendar',
        type: 'event',
        title: 'Urgent QA Defect Review Sync',
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        url: 'https://calendar.google.com/event?id=505',
        assignees: ['jane_doe', 'qa_team'],
        metadata: {
          startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'calendar-606',
        source: 'calendar',
        type: 'event',
        title: 'Sprint 12 Deadline',
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        url: 'https://calendar.google.com/event?id=606',
        assignees: ['jane_doe', 'bob_pm', 'sara_design'],
        metadata: {
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
        }
      }
    ]
  };

  return NextResponse.json(mockContext);
}