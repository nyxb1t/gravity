/**
 * @file ai/conflicts/rules/deadlineConflict.ts
 * @description Detects conflicting and clashing deadlines.
 *
 * This rule fires in two scenarios:
 *
 * 1. **Calendar overlap** — two calendar events the user is attending overlap
 *    in time (classic double-booking).
 *
 * 2. **Deadline collision** — two or more non-calendar items have `dueDate`
 *    values that land within a configurable collision window of each other,
 *    AND both are assigned to the user, making simultaneous completion
 *    impossible.
 *
 * All logic is pure, deterministic, and O(n²) over the item list.
 * For typical workspace sizes (< 500 items) this is perfectly acceptable.
 */

import type { WorkspaceItem } from "@/types";
import type {
  ConflictRule,
  DetectedConflict,
  RuleContext,
  SuggestedAction,
} from "../types";
import { SEVERITY_SCORE } from "../types";
import { generateConflictId, isAssignedToUser, resolveDeadlineMs } from "../utils";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Two deadlines are considered "colliding" when they land within this many
 * milliseconds of each other and are both assigned to the same user.
 *
 * Default: 2 hours.
 */
const DEADLINE_COLLISION_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * A deadline is only considered "upcoming" (and thus worth checking for
 * conflicts) when it falls within this window from now.
 *
 * Default: 48 hours.
 */
const UPCOMING_HORIZON_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns `true` when two calendar events overlap in time. */
function eventsOverlap(a: WorkspaceItem, b: WorkspaceItem): boolean {
  const aStart = a.metadata.eventStart as string | undefined;
  const aEnd = a.metadata.eventEnd as string | undefined;
  const bStart = b.metadata.eventStart as string | undefined;
  const bEnd = b.metadata.eventEnd as string | undefined;

  if (!aStart || !aEnd || !bStart || !bEnd) return false;

  const aStartMs = new Date(aStart).getTime();
  const aEndMs = new Date(aEnd).getTime();
  const bStartMs = new Date(bStart).getTime();
  const bEndMs = new Date(bEnd).getTime();

  // Overlap condition: A starts before B ends AND B starts before A ends.
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/** Formats a timestamp as a short, human-readable relative string. */
function fmtRelative(isoTs: string, nowMs: number): string {
  const diffMs = new Date(isoTs).getTime() - nowMs;
  const diffMins = Math.round(diffMs / 60_000);

  if (diffMins < 0) return "overdue";
  if (diffMins < 60) return `in ${diffMins} min${diffMins !== 1 ? "s" : ""}`;
  const hours = Math.round(diffMins / 60);
  return `in ${hours} hr${hours !== 1 ? "s" : ""}`;
}

/** Formats a calendar event's window as "HH:MM – HH:MM". */
function fmtEventWindow(item: WorkspaceItem): string {
  const start = item.metadata.eventStart as string | undefined;
  const end = item.metadata.eventEnd as string | undefined;
  if (!start || !end) return item.title;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  return `${fmt(start)} – ${fmt(end)}`;
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const deadlineConflictRule: ConflictRule = {
  name: "DeadlineConflictRule",

  detect(items: WorkspaceItem[], context: RuleContext): DetectedConflict[] {
    const { nowMs } = context;
    const conflicts: DetectedConflict[] = [];
    const detectedAt = new Date(nowMs).toISOString();

    // ── 1. Calendar event overlaps ──────────────────────────────────────────
    // Collect events the user is attending that start in the future (or very recently).
    const myEvents = items.filter(
      (item) =>
        item.kind === "event" &&
        isAssignedToUser(item, context) &&
        (() => {
          const start = item.metadata.eventStart as string | undefined;
          if (!start) return false;
          const startMs = new Date(start).getTime();
          // Include events starting within the next 48 hours or currently in progress.
          return startMs >= nowMs - 60 * 60 * 1000 && startMs <= nowMs + UPCOMING_HORIZON_MS;
        })()
    );

    // Check every unique pair for overlap — O(n²) but n is small for calendar events.
    for (let i = 0; i < myEvents.length; i++) {
      for (let j = i + 1; j < myEvents.length; j++) {
        const a = myEvents[i];
        const b = myEvents[j];

        if (!eventsOverlap(a, b)) continue;

        const aWindow = fmtEventWindow(a);
        const bWindow = fmtEventWindow(b);

        const suggestedActions: SuggestedAction[] = [
          {
            label: `Decline "${b.title}"`,
            rationale: `Declining the lower-priority event frees your schedule for "${a.title}". Update the organiser so they can find alternate coverage.`,
            targetItemId: b.id,
            actionUrl: b.url,
          },
          {
            label: `Decline "${a.title}"`,
            rationale: `If "${b.title}" is higher priority, decline "${a.title}" and notify the organiser.`,
            targetItemId: a.id,
            actionUrl: a.url,
          },
          {
            label: "Request a time shift for one event",
            rationale: "Ask one of the organisers to reschedule so both meetings can be attended without conflict.",
            targetItemId: null,
          },
        ];

        conflicts.push({
          id: generateConflictId("deadline", a.id, b.id),
          kind: "conflicting_deadlines",
          type: "schedule",
          items: [a, b],
          relatedItemIds: [a.id, b.id],
          description: `Double-booked: "${a.title}" (${aWindow}) overlaps with "${b.title}" (${bWindow}).`,
          explanation:
            `You are scheduled to attend two overlapping events at the same time. ` +
            `"${a.title}" runs ${aWindow} and "${b.title}" runs ${bWindow}. ` +
            `Attending both simultaneously is impossible — one must be declined or rescheduled ` +
            `before either event starts.`,
          severity: "critical",
          severityScore: SEVERITY_SCORE.critical,
          suggestedActions,
          detectedAt,
          acknowledged: false,
        });
      }
    }

    // ── 2. Deadline collisions (non-calendar items) ─────────────────────────
    // Collect items with a dueDate within the upcoming horizon that are assigned to the user.
    const upcomingDeadlineItems = items.filter((item) => {
      if (item.kind === "event") return false; // Already handled above.
      const deadlineMs = resolveDeadlineMs(item);
      if (deadlineMs === null) return false;
      return (
        deadlineMs > nowMs && // Not yet overdue
        deadlineMs <= nowMs + UPCOMING_HORIZON_MS && // Within horizon
        isAssignedToUser(item, context) // Assigned to this user
      );
    });

    // Sort by deadline ascending so we always pair earlier with later items.
    upcomingDeadlineItems.sort((a, b) => {
      const aMs = resolveDeadlineMs(a) ?? 0;
      const bMs = resolveDeadlineMs(b) ?? 0;
      return aMs - bMs;
    });

    for (let i = 0; i < upcomingDeadlineItems.length; i++) {
      for (let j = i + 1; j < upcomingDeadlineItems.length; j++) {
        const a = upcomingDeadlineItems[i];
        const b = upcomingDeadlineItems[j];

        const aMs = resolveDeadlineMs(a)!;
        const bMs = resolveDeadlineMs(b)!;

        if (Math.abs(aMs - bMs) > DEADLINE_COLLISION_WINDOW_MS) {
          // Items are sorted ascending, so once the gap exceeds the window
          // all subsequent pairs will be even wider. Break inner loop.
          break;
        }

        const aRel = fmtRelative(new Date(aMs).toISOString(), nowMs);
        const bRel = fmtRelative(new Date(bMs).toISOString(), nowMs);

        // Determine severity based on how close the nearest deadline is.
        const nearestMs = Math.min(aMs, bMs);
        const hoursUntil = (nearestMs - nowMs) / 3_600_000;
        const severity = hoursUntil < 2 ? "critical" : hoursUntil < 6 ? "high" : "medium";

        const suggestedActions: SuggestedAction[] = [
          {
            label: `Prioritise "${a.title}"`,
            rationale: `"${a.title}" (due ${aRel}) has the earlier deadline. Focus on it first and negotiate an extension for "${b.title}".`,
            targetItemId: a.id,
            actionUrl: a.url,
          },
          {
            label: "Negotiate a deadline extension",
            rationale: `Both deadlines land within ${Math.round(DEADLINE_COLLISION_WINDOW_MS / 60_000)} minutes of each other. Request that one be extended to create a realistic completion window.`,
            targetItemId: null,
          },
          {
            label: "Delegate one item",
            rationale: "Assign one of the conflicting items to another available team member to avoid the bottleneck.",
            targetItemId: null,
          },
        ];

        conflicts.push({
          id: generateConflictId("deadline", a.id, b.id),
          kind: "conflicting_deadlines",
          type: "schedule",
          items: [a, b],
          relatedItemIds: [a.id, b.id],
          description: `Deadline collision: "${a.title}" (due ${aRel}) and "${b.title}" (due ${bRel}) are both assigned to you within the same time window.`,
          explanation:
            `You have two items assigned to you with deadlines landing within ` +
            `${Math.round(DEADLINE_COLLISION_WINDOW_MS / 60_000)} minutes of each other. ` +
            `"${a.title}" is due ${aRel} and "${b.title}" is due ${bRel}. ` +
            `Completing both independently within this window is unrealistic ` +
            `and will likely result in at least one missed deadline.`,
          severity,
          severityScore: SEVERITY_SCORE[severity],
          suggestedActions,
          detectedAt,
          acknowledged: false,
        });
      }
    }

    return conflicts;
  },
};
