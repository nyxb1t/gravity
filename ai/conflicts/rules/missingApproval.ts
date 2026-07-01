/**
 * @file ai/conflicts/rules/missingApproval.ts
 * @description Detects items that require user approval but haven't received it.
 *
 * An item is flagged as a "missing approval" conflict when ALL of the
 * following conditions hold:
 *
 *  1. The item's tags or metadata explicitly signal it requires sign-off
 *     (tag: "approval-required", "needs-approval", "pending-review", etc.
 *      OR `metadata.requiresApproval === true`).
 *  2. The current user is listed as a reviewer/approver for the item.
 *  3. The item is not yet closed/resolved (checked via `metadata.status`
 *     or `metadata.state`).
 *  4. The item was created or updated before a configurable staleness
 *     threshold (default 24 h) — very new items get a grace period.
 *
 * Additionally, if the awaiting-approval item has a `dueDate` and that
 * deadline is within the critical window, the conflict severity is escalated
 * to "critical".
 *
 * No LLM. Pure tag/metadata inspection.
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
  isReviewerOrApprover,
  resolveDeadlineMs,
  isItemClosed,
} from "../utils";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Tags (case-insensitive) that signal the item is pending approval.
 * Any match is sufficient.
 */
const APPROVAL_REQUIRED_TAGS = new Set([
  "approval-required",
  "needs-approval",
  "pending-approval",
  "review-required",
  "pending-review",
  "sign-off-required",
  "awaiting-approval",
]);

/**
 * Items younger than this threshold are given a grace period and NOT flagged.
 * This avoids noisy conflicts the moment a review request lands.
 *
 * Default: 1 hour.
 */
const GRACE_PERIOD_MS = 1 * 60 * 60 * 1000;

/**
 * A deadline within this many hours is considered "imminent" and escalates
 * severity to "critical".
 *
 * Default: 4 hours.
 */
const IMMINENT_DEADLINE_HOURS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the item is tagged as requiring approval. */
function requiresApproval(item: WorkspaceItem): boolean {
  // Explicit metadata flag.
  if (item.metadata.requiresApproval === true) return true;
  if (item.metadata.approvalRequired === true) return true;

  // Tag-based detection (case-insensitive).
  return item.tags.some((tag) => APPROVAL_REQUIRED_TAGS.has(tag.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const missingApprovalRule: ConflictRule = {
  name: "MissingApprovalRule",

  detect(items: WorkspaceItem[], context: RuleContext): DetectedConflict[] {
    const { nowMs, displayName } = context;
    const conflicts: DetectedConflict[] = [];
    const detectedAt = new Date(nowMs).toISOString();

    for (const item of items) {
      // Gate 1: Must require approval.
      if (!requiresApproval(item)) continue;

      // Gate 2: Current user must be a reviewer or approver.
      if (!isReviewerOrApprover(item, context)) continue;

      // Gate 3: Item must not already be closed/resolved.
      if (isItemClosed(item)) continue;

      // Gate 4: Enforce grace period — skip items that just arrived.
      const ageMs = nowMs - new Date(item.updatedAt ?? item.createdAt).getTime();
      if (ageMs < GRACE_PERIOD_MS) continue;

      // ── Determine severity ────────────────────────────────────────────────
      const deadlineMs = resolveDeadlineMs(item);
      let severity: DetectedConflict["severity"] = "high";

      if (deadlineMs !== null) {
        const hoursUntilDeadline = (deadlineMs - nowMs) / 3_600_000;
        if (hoursUntilDeadline <= 0) {
          severity = "critical"; // Past deadline — critical.
        } else if (hoursUntilDeadline <= IMMINENT_DEADLINE_HOURS) {
          severity = "critical"; // Within imminent window — critical.
        } else if (hoursUntilDeadline <= 24) {
          severity = "high";
        } else {
          severity = "medium";
        }
      }

      // ── Build deadline context string ─────────────────────────────────────
      let deadlineContext = "";
      if (deadlineMs !== null) {
        const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
        if (hoursLeft <= 0) {
          deadlineContext = " The approval deadline has already passed.";
        } else {
          const label =
            hoursLeft < 1
              ? `${Math.round(hoursLeft * 60)} minutes`
              : hoursLeft < 24
              ? `${Math.round(hoursLeft)} hours`
              : `${Math.round(hoursLeft / 24)} days`;
          deadlineContext = ` The approval deadline is in ${label}.`;
        }
      }

      // ── Build suggested actions ───────────────────────────────────────────
      const suggestedActions: SuggestedAction[] = [
        {
          label: `Review and approve "${item.title}"`,
          rationale:
            `As the designated reviewer, your approval is the direct path to unblocking this item.` +
            deadlineContext,
          targetItemId: item.id,
          actionUrl: item.url,
        },
        {
          label: "Delegate the review",
          rationale:
            `If you cannot review "${item.title}" in time, reassign the review to another qualified team member ` +
            `to prevent it from blocking downstream work.`,
          targetItemId: item.id,
        },
      ];

      if (deadlineMs !== null && deadlineMs - nowMs < IMMINENT_DEADLINE_HOURS * 3_600_000) {
        suggestedActions.push({
          label: "Notify the author of the delay",
          rationale:
            `Let the author know that the review is pending so they can take contingency action ` +
            `(e.g. escalate, find an alternate approver, or extend the deadline).`,
          targetItemId: item.id,
          actionUrl: item.url,
        });
      }

      // ── Build explanation ─────────────────────────────────────────────────
      const ageHours = Math.round(ageMs / 3_600_000);
      const ageLabel =
        ageHours < 1 ? "less than an hour" : `${ageHours} hour${ageHours !== 1 ? "s" : ""}`;

      const explanation =
        `"${item.title}" has been waiting for your approval for ${ageLabel}. ` +
        `You are listed as a required reviewer on this ${item.kind.replace("_", " ")} ` +
        `from ${item.source}. Without your sign-off, work that depends on this item ` +
        `cannot proceed.` +
        deadlineContext;

      conflicts.push({
        id: generateConflictId("approval", item.id),
        kind: "missing_approval",
        type: "attention",
        items: [item],
        relatedItemIds: [item.id],
        description: `${displayName} has a pending approval on "${item.title}" that has not been actioned.`,
        explanation,
        severity,
        severityScore: SEVERITY_SCORE[severity],
        suggestedActions,
        detectedAt,
        acknowledged: false,
      });
    }

    return conflicts;
  },
};
