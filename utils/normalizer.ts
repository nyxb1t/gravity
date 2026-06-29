

import { NormalizedItem } from '../types/normalizer';

export class GravityNormalizer {
  // ── GitHub ──────────────────────────────────────────────────────────────
  // GitHub logins are close to Slack usernames — use as-is.
  // e.g. "jane-doe" on GitHub ≈ "jane-doe" on Slack
  static fromGitHub(issueOrPr: any): NormalizedItem {
    const isPr = !!issueOrPr.pull_request;
    const isCritical = issueOrPr.labels?.some((l: any) =>
      ['bug', 'critical', 'blocker'].includes(l.name.toLowerCase())
    ) ?? false;

    return {
      id: `github-${issueOrPr.id}`,
      source: 'github',
      type: isPr ? 'pr' : 'issue',
      title: issueOrPr.title,
      status: issueOrPr.state === 'open' ? 'open' : 'closed',
      updatedAt: issueOrPr.updated_at,
      url: issueOrPr.html_url,
      assignees: issueOrPr.assignees?.map((a: any) => a.login) || [],
      metadata: {
        labels: issueOrPr.labels?.map((l: any) => l.name) || [],
        isCritical
      }
    };
  }

  // ── Notion ───────────────────────────────────────────────────────────────
  // Notion people names are display names — should match Slack display names.
  // e.g. "Jane Doe" on Notion → confirm this matches Slack on Day 9.
  static fromNotion(page: any): NormalizedItem {
    const props = page.properties;
    const title = props?.Name?.title?.[0]?.plain_text || 'Untitled';
    const statusName = props?.Status?.status?.name?.toLowerCase() || '';

    let status: NormalizedItem['status'] = 'open';
    if (statusName === 'blocked') status = 'blocked';
    else if (statusName === 'pending approval') status = 'pending_approval';
    else if (statusName === 'done' || statusName === 'closed') status = 'closed';

    return {
      id: `notion-${page.id}`,
      source: 'notion',
      type: 'task',
      title,
      status,
      updatedAt: page.last_edited_time,
      url: page.url,
      assignees: props?.Assignee?.people?.map((p: any) => p.name) || [],
      metadata: {
        parentProject: props?.Project?.relation?.[0]?.id || 'General'
      }
    };
  }

  // ── Google Calendar ───────────────────────────────────────────────────────
  // ⚠️  TODO Day 9: Calendar returns emails (jane@company.com).
  //     Need to map these to Slack usernames before connecting to Person 1.
  //     Use Slack's users.lookupByEmail API:
  //     https://api.slack.com/methods/users.lookupByEmail
  static fromGoogleCalendar(event: any): NormalizedItem {
    return {
      id: `calendar-${event.id}`,
      source: 'calendar',
      type: 'event',
      title: event.summary || 'Untitled Event',
      status: 'scheduled',
      updatedAt: event.updated || new Date().toISOString(),
      url: event.htmlLink,
      // TODO Day 9: map emails → Slack usernames via users.lookupByEmail
      assignees: event.attendees?.map((a: any) => a.email) || [],
      metadata: {
        startTime: event.start?.dateTime || event.start?.date,
        endTime: event.end?.dateTime || event.end?.date
      }
    };
  }
}