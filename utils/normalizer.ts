
import type { WorkspaceItem } from '@/types';

/**
 * @class GravityNormalizer
 * @description Converts provider-native API responses into the canonical
 * `WorkspaceItem` shape that the Gravity intelligence pipeline consumes.
 *
 * Each static method handles one integration. The output is always a fully
 * populated `WorkspaceItem` — never the defunct flat NormalizedItem shape.
 */
export class GravityNormalizer {
  // ── GitHub ──────────────────────────────────────────────────────────────
  // GitHub logins are close to Slack usernames — use as-is.
  // e.g. "jane-doe" on GitHub ≈ "jane-doe" on Slack
  static fromGitHub(issueOrPr: any): WorkspaceItem {
    const isPr = !!issueOrPr.pull_request;
    const labels: string[] = issueOrPr.labels?.map((l: any) => l.name) ?? [];
    const isCritical = labels.some((l) =>
      ['bug', 'critical', 'blocker'].includes(l.toLowerCase())
    );

    return {
      id: `github-${issueOrPr.id}`,
      source: 'github',
      kind: isPr ? 'pr_review' : 'issue',
      title: issueOrPr.title,
      body: issueOrPr.body ?? '',
      createdAt: issueOrPr.created_at ?? new Date().toISOString(),
      updatedAt: issueOrPr.updated_at,
      url: issueOrPr.html_url,
      author: issueOrPr.user
        ? { id: String(issueOrPr.user.id), displayName: issueOrPr.user.login }
        : null,
      participants: (issueOrPr.assignees ?? []).map((a: any) => ({
        id: String(a.id),
        displayName: a.login,
        role: 'assignee',
      })),
      mentionsUser: false, // resolved downstream when user context is available
      channel: issueOrPr.repository_url?.split('/').slice(-2).join('/'),
      tags: labels,
      metadata: { isCritical },
    };
  }

  // ── Notion ───────────────────────────────────────────────────────────────
  // Notion people names are display names — should match Slack display names.
  // e.g. "Jane Doe" on Notion → confirm this matches Slack on Day 9.
  static fromNotion(page: any): WorkspaceItem {
    const props = page.properties;
    const title = props?.Name?.title?.[0]?.plain_text || 'Untitled';
    const statusName = props?.Status?.status?.name?.toLowerCase() ?? '';
    const assignees: Array<{ id: string; displayName: string; role: string }> =
      (props?.Assignee?.people ?? []).map((p: any) => ({
        id: String(p.id),
        displayName: p.name,
        role: 'assignee',
      }));

    return {
      id: `notion-${page.id}`,
      source: 'notion',
      kind: 'page_edit',
      title,
      body: '',
      createdAt: page.created_time ?? new Date().toISOString(),
      updatedAt: page.last_edited_time,
      url: page.url,
      author: page.created_by
        ? { id: String(page.created_by.id), displayName: page.created_by.name ?? 'Unknown' }
        : null,
      participants: assignees,
      mentionsUser: false,
      channel: props?.Project?.relation?.[0]?.id ?? 'General',
      tags: [statusName].filter(Boolean),
      metadata: {
        parentProject: props?.Project?.relation?.[0]?.id ?? 'General',
        statusName,
      },
    };
  }

  // ── Google Calendar ───────────────────────────────────────────────────────
  // ⚠️  TODO Day 9: Calendar returns emails (jane@company.com).
  //     Need to map these to Slack usernames before connecting to Person 1.
  //     Use Slack's users.lookupByEmail API:
  //     https://api.slack.com/methods/users.lookupByEmail
  static fromGoogleCalendar(event: any): WorkspaceItem {
    const attendees = event.attendees ?? [];
    return {
      id: `calendar-${event.id}`,
      source: 'calendar',
      kind: 'event',
      title: event.summary || 'Untitled Event',
      body: event.description ?? '',
      createdAt: event.created ?? new Date().toISOString(),
      updatedAt: event.updated ?? new Date().toISOString(),
      url: event.htmlLink,
      author: event.organizer
        ? { id: event.organizer.email, displayName: event.organizer.displayName ?? event.organizer.email }
        : null,
      // TODO Day 9: map emails → Slack usernames via users.lookupByEmail
      participants: attendees.map((a: any) => ({
        id: a.email,
        displayName: a.displayName ?? a.email,
        role: a.responseStatus ?? 'attendee',
      })),
      mentionsUser: false,
      channel: undefined,
      tags: [],
      metadata: {
        startTime: event.start?.dateTime ?? event.start?.date,
        endTime: event.end?.dateTime ?? event.end?.date,
      },
    };
  }
}