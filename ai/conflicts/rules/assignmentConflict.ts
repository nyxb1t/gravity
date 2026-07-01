/**
 * @file ai/conflicts/rules/assignmentConflict.ts
 * @description Detects assignment overload and simultaneous assignment conflicts.
 *
 * This rule detects two distinct over-assignment scenarios:
 *
 * **Scenario A — Simultaneous urgent assignments:**
 *   The user is the primary assignee on two or more items that are
 *   simultaneously "urgent" (deadline within the urgent window OR tagged as
 *   high-priority). Having multiple urgent assignments at once is a conflict
 *   because the user's bandwidth is a scarce resource.
 *
 * **Scenario B — Same-assignee on blocking chain:**
 *   The user is assigned to both a blocked item AND the blocker item that is
 *   blocking it. This creates a circular attention conflict — the user must
 *   resolve the blocker before they can progress on the blocked item, but
 *   both are demanding attention simultaneously.
 *
 * No LLM. Pure assignment + deadline inspection.
 */

import type { WorkspaceItem } from "@/types";
import type {
  ConflictRule,
  DetectedConflict,
  RuleContext,
  SuggestedAction,
} from "../types";
import { SEVERITY_SCORE } from "../types";
import {
  generateConflictId,
  isPrimaryAssignee,
  isItemClosed,
  resolveDeadlineMs,
} from "../utils";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * A deadline within this many hours qualifies as "urgent" for assignment-
 * conflict detection purposes.
 *
 * Default: 8 hours.
 */
const URGENT_DEADLINE_HOURS = 8;

/**
 * Maximum number of simultaneous urgent assignments before every additional
 * pair is flagged. We only flag when count >= this threshold.
 *
 * Default: 2 (flag when user has 2+ urgent items assigned).
 */
const URGENT_ASSIGNMENT_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tags that mark an item as explicitly high-priority regardless of deadline. */
const HIGH_PRIORITY_TAGS = new Set([
  "p0",
  "p1",
  "urgent",
  "critical",
  "high-priority",
  "blocker",
  "release-blocker",
]);

/** Returns true when an item is considered "urgent" by deadline OR tags. */
function isUrgentItem(item: WorkspaceItem, nowMs: number): boolean {
  // Tag-based urgency.
  if (item.tags.some((t) => HIGH_PRIORITY_TAGS.has(t.toLowerCase()))) return true;

  // Deadline-based urgency.
  const deadlineMs = resolveDeadlineMs(item);
  if (deadlineMs === null) return false;

  const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
  return hoursLeft >= 0 && hoursLeft <= URGENT_DEADLINE_HOURS;
}

/** Returns true when the item is explicitly marked as blocked. */
function isBlocked(item: WorkspaceItem): boolean {
  return (
    item.metadata.isBlocked === true ||
    item.tags.some((t) => t.toLowerCase() === "blocked")
  );
}

/** Returns true when the item is explicitly marked as a blocker. */
function isBlockerItem(item: WorkspaceItem): boolean {
  return (
    item.metadata.isBlocker === true ||
    item.tags.some((t) => ["blocker", "blocking"].includes(t.toLowerCase()))
  );
}

/**
 * Formats a relative time label for a deadline.
 * Returns "overdue" | "in X min/hr/day".
 */
function fmtDeadline(deadlineMs: number, nowMs: number): string {
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return "overdue";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `in ${mins} min${mins !== 1 ? "s" : ""}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hr${hrs !== 1 ? "s" : ""}`;
  const days = Math.round(hrs / 24);
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const assignmentConflictRule: ConflictRule = {
  name: "AssignmentConflictRule",

  detect(items: WorkspaceItem[], context: RuleContext): DetectedConflict[] {
    const { nowMs, displayName } = context;
    const conflicts: DetectedConflict[] = [];
    const detectedAt = new Date(nowMs).toISOString();
    const emitted = new Set<string>();

    // Collect items where the user is the PRIMARY assignee and item is open.
    const myAssignedItems = items.filter(
      (item) => isPrimaryAssignee(item, context) && !isItemClosed(item)
    );

    // ── Scenario A: Simultaneous urgent assignments ───────────────────────────
    const urgentItems = myAssignedItems.filter((item) => isUrgentItem(item, nowMs));

    if (urgentItems.length >= URGENT_ASSIGNMENT_THRESHOLD) {
      // Emit one conflict per unique pair of urgent items.
      for (let i = 0; i < urgentItems.length; i++) {
        for (let j = i + 1; j < urgentItems.length; j++) {
          const a = urgentItems[i];
          const b = urgentItems[j];

          const pairKey = [a.id, b.id].sort().join("|");
          if (emitted.has(pairKey)) continue;
          emitted.add(pairKey);

          const aDeadlineMs = resolveDeadlineMs(a);
          const bDeadlineMs = resolveDeadlineMs(b);

          const aDeadlineLabel = aDeadlineMs
            ? fmtDeadline(aDeadlineMs, nowMs)
            : "no deadline";
          const bDeadlineLabel = bDeadlineMs
            ? fmtDeadline(bDeadlineMs, nowMs)
            : "no deadline";

          // Severity is critical when any item is already overdue or due within 2h.
          const minDeadlineMs = [aDeadlineMs, bDeadlineMs]
            .filter((d): d is number => d !== null)
            .reduce((min, d) => Math.min(min, d), Infinity);

          let severity: DetectedConflict["severity"] = "high";
          if (minDeadlineMs !== Infinity) {
            const hoursLeft = (minDeadlineMs - nowMs) / 3_600_000;
            if (hoursLeft <= 0) {
              severity = "critical";
            } else if (hoursLeft <= 2) {
              severity = "critical";
            } else if (hoursLeft <= 4) {
              severity = "high";
            }
          }

          const suggestedActions: SuggestedAction[] = [
            {
              label: `Prioritise "${a.title}"`,
              rationale: `Focus on "${a.title}" (${aDeadlineLabel}) first, then immediately switch to "${b.title}" (${bDeadlineLabel}).`,
              targetItemId: a.id,
              actionUrl: a.url,
            },
            {
              label: `Delegate "${b.title}"`,
              rationale: `Reassign "${b.title}" to another team member to free your bandwidth and prevent both items from slipping.`,
              targetItemId: b.id,
              actionUrl: b.url,
            },
            {
              label: "Negotiate a deadline extension",
              rationale: "Communicate the bandwidth constraint to the relevant stakeholders and agree on which deadline can be pushed.",
              targetItemId: null,
            },
          ];

          conflicts.push({
            id: generateConflictId("assignment", a.id, b.id),
            kind: "assignment_conflict",
            type: "attention",
            items: [a, b],
            relatedItemIds: [a.id, b.id],
            description: `${displayName} has two simultaneous urgent assignments: "${a.title}" (${aDeadlineLabel}) and "${b.title}" (${bDeadlineLabel}).`,
            explanation:
              `You are the primary assignee on two urgent items that are competing for your ` +
              `attention simultaneously. "${a.title}" is due ${aDeadlineLabel} and ` +
              `"${b.title}" is due ${bDeadlineLabel}. ` +
              `Attempting to progress both in parallel will likely result in one or both ` +
              `being delivered late or below quality. A prioritisation or delegation decision ` +
              `is required.`,
            severity,
            severityScore: SEVERITY_SCORE[severity],
            suggestedActions,
            detectedAt,
            acknowledged: false,
          });
        }
      }
    }

    // ── Scenario B: User assigned to both blocker and blocked item ────────────
    const myBlockerItems = myAssignedItems.filter(isBlockerItem);
    const myBlockedItems = myAssignedItems.filter(isBlocked);

    for (const blockerItem of myBlockerItems) {
      for (const blockedItem of myBlockedItems) {
        if (blockerItem.id === blockedItem.id) continue;

        const pairKey = [blockerItem.id, blockedItem.id].sort().join("|");
        if (emitted.has(pairKey)) continue;
        emitted.add(pairKey);

        const deadlineMs = resolveDeadlineMs(blockedItem);
        const deadlineLabel = deadlineMs ? fmtDeadline(deadlineMs, nowMs) : null;

        let severity: DetectedConflict["severity"] = "high";
        if (deadlineMs !== null) {
          const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
          if (hoursLeft <= 0 || hoursLeft <= 4) severity = "critical";
        }

        const suggestedActions: SuggestedAction[] = [
          {
            label: `Resolve blocker "${blockerItem.title}" first`,
            rationale: `Fixing the blocker unblocks "${blockedItem.title}"${deadlineLabel ? ` (due ${deadlineLabel})` : ""} and lets you progress on both sequentially rather than being stuck on both simultaneously.`,
            targetItemId: blockerItem.id,
            actionUrl: blockerItem.url,
          },
          {
            label: `Transfer ownership of "${blockerItem.title}"`,
            rationale: `Delegating the blocker to another engineer lets you focus on progressing "${blockedItem.title}" while the blocker is resolved in parallel.`,
            targetItemId: blockerItem.id,
            actionUrl: blockerItem.url,
          },
        ];

        conflicts.push({
          id: generateConflictId("assignment", blockerItem.id, blockedItem.id),
          kind: "assignment_conflict",
          type: "dependency",
          items: [blockerItem, blockedItem],
          relatedItemIds: [blockerItem.id, blockedItem.id],
          description:
            `${displayName} is assigned to both the blocker "${blockerItem.title}" and the blocked item "${blockedItem.title}"` +
            `${deadlineLabel ? ` (due ${deadlineLabel})` : ""}.`,
          explanation:
            `You are the owner of both "${blockerItem.title}" (a blocker) and "${blockedItem.title}" ` +
            `(which depends on the blocker). This creates a sequencing trap — you cannot progress ` +
            `on "${blockedItem.title}" until "${blockerItem.title}" is resolved, but both are ` +
            `competing for your attention. The blocker must be prioritised immediately to break the chain.` +
            (deadlineLabel
              ? ` "${blockedItem.title}" has a deadline ${deadlineLabel}, adding time pressure.`
              : ""),
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
