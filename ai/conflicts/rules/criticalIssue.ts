/**
 * @file ai/conflicts/rules/criticalIssue.ts
 * @description Detects unresolved critical issues that require immediate attention.
 *
 * An item is a "critical issue" conflict when ANY of these signals are present:
 *
 * **Tag signals:**
 *   "critical", "p0", "incident", "sev1", "sev-1", "severity-critical",
 *   "production-issue", "outage", "hotfix"
 *
 * **Metadata signals:**
 *   `metadata.isCritical === true`
 *   `metadata.severity === "critical"` | `"p0"` | `"sev1"`
 *   `metadata.priority === "critical"` | `"p0"`
 *
 * **Body/title keyword signals (case-insensitive):**
 *   "production down", "outage", "data loss", "security breach",
 *   "heap out of memory", "crash", "regression", "incident"
 *   (Only when the item is also a GitHub issue or Slack message.)
 *
 * The conflict is only surfaced when:
 *  - The item is NOT already closed/resolved.
 *  - The item is relevant to the user (assigned, mentioned, or from a priority source).
 *
 * No LLM. Pure signal inspection.
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
  isAssignedToUser,
  isItemClosed,
  resolveDeadlineMs,
} from "../utils";

// ---------------------------------------------------------------------------
// Signal catalogues
// ---------------------------------------------------------------------------

const CRITICAL_TAGS = new Set([
  "critical",
  "p0",
  "sev1",
  "sev-1",
  "severity-critical",
  "severity:critical",
  "incident",
  "production-issue",
  "outage",
  "hotfix",
  "release-blocker",
  "data-loss",
  "security",
]);

/** Severity strings in `metadata.severity` / `metadata.priority` that qualify. */
const CRITICAL_SEVERITY_VALUES = new Set(["critical", "p0", "sev1", "sev-1"]);

/**
 * Keyword patterns applied to `title + body` for issue and message kinds.
 * Each entry is a RegExp-compatible string.
 */
const CRITICAL_BODY_PATTERNS: RegExp[] = [
  /production\s+down/i,
  /\boutage\b/i,
  /\bdata\s+loss\b/i,
  /\bsecurity\s+breach\b/i,
  /\bheap\s+out\s+of\s+memory\b/i,
  /\bserver\s+crash/i,
  /\bmemory\s+leak\b/i,
  /\bregression\b/i,
  /\bincident\b/i,
  /\bsev[- ]?[01]\b/i,
];

/** Item kinds eligible for body-pattern scanning (avoids false positives in docs). */
const BODY_SCAN_KINDS = new Set(["issue", "message", "mention", "notification"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the item carries explicit critical signals via tags or metadata. */
function hasExplicitCriticalSignal(item: WorkspaceItem): boolean {
  // Tag match.
  if (item.tags.some((t) => CRITICAL_TAGS.has(t.toLowerCase()))) return true;

  // Metadata: isCritical flag.
  if (item.metadata.isCritical === true) return true;

  // Metadata: severity / priority string values.
  const sev = String(item.metadata.severity ?? "").toLowerCase();
  const pri = String(item.metadata.priority ?? "").toLowerCase();
  if (CRITICAL_SEVERITY_VALUES.has(sev) || CRITICAL_SEVERITY_VALUES.has(pri)) return true;

  return false;
}

/** Returns true when the item's text content contains critical-issue keywords. */
function hasBodyKeywordSignal(item: WorkspaceItem): boolean {
  if (!BODY_SCAN_KINDS.has(item.kind)) return false;

  const haystack = `${item.title} ${item.body}`;
  return CRITICAL_BODY_PATTERNS.some((pattern) => pattern.test(haystack));
}

/** Returns true when the item is a critical issue by any signal. */
function isCriticalIssue(item: WorkspaceItem): boolean {
  return hasExplicitCriticalSignal(item) || hasBodyKeywordSignal(item);
}

/**
 * Checks whether the user is "relevant" to this item.
 * More permissive than strict assignment — also captures priority-source
 * items and direct @-mentions.
 */
function isUserRelevant(
  item: WorkspaceItem,
  context: RuleContext,
  prioritySources: string[]
): boolean {
  if (isAssignedToUser(item, context)) return true;
  if (item.mentionsUser) return true;

  // Priority source channel match.
  const channelLower = (item.channel ?? "").toLowerCase();
  return prioritySources.some(
    (ps) => channelLower.includes(ps.toLowerCase()) || ps.toLowerCase().includes(channelLower)
  );
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const criticalIssueRule: ConflictRule = {
  name: "CriticalIssueRule",

  detect(
    items: WorkspaceItem[],
    context: RuleContext & { prioritySources?: string[] }
  ): DetectedConflict[] {
    const { nowMs, displayName } = context;
    const prioritySources: string[] = ((context as unknown) as Record<string, unknown>).prioritySources as string[] ?? [];
    const conflicts: DetectedConflict[] = [];
    const detectedAt = new Date(nowMs).toISOString();

    for (const item of items) {
      // Gate 1: Must be a critical issue by signal.
      if (!isCriticalIssue(item)) continue;

      // Gate 2: Must not already be closed.
      if (isItemClosed(item)) continue;

      // Gate 3: Must be relevant to the current user.
      if (!isUserRelevant(item, context, prioritySources)) continue;

      // ── Determine age ─────────────────────────────────────────────────────
      const latestActivity = new Date(item.updatedAt ?? item.createdAt).getTime();
      const ageMs = nowMs - latestActivity;
      const ageHours = ageMs / 3_600_000;
      const ageLabel =
        ageHours < 1
          ? `${Math.round(ageHours * 60)} min`
          : ageHours < 24
          ? `${Math.round(ageHours)} hr`
          : `${Math.round(ageHours / 24)} day`;
      const agePlural = parseFloat(ageLabel) !== 1 ? "s" : "";

      // ── Determine severity ────────────────────────────────────────────────
      // Critical issues are always at least "high".
      // Escalate to "critical" when: deadline is imminent, item is overdue, or very old and unresolved.
      const deadlineMs = resolveDeadlineMs(item);
      let severity: DetectedConflict["severity"] = "high";

      if (deadlineMs !== null) {
        const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
        if (hoursLeft <= 0 || hoursLeft <= 4) {
          severity = "critical";
        }
      } else if (ageHours >= 12) {
        // A critical issue unresolved for 12+ hours with no deadline is still critical.
        severity = "critical";
      }

      // ── Build deadline context ────────────────────────────────────────────
      let deadlineCtx = "";
      if (deadlineMs !== null) {
        const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
        if (hoursLeft <= 0) {
          deadlineCtx = " Its resolution deadline has already passed.";
        } else {
          const dLabel =
            hoursLeft < 1
              ? `${Math.round(hoursLeft * 60)} min`
              : hoursLeft < 24
              ? `${Math.round(hoursLeft)} hr`
              : `${Math.round(hoursLeft / 24)} day`;
          deadlineCtx = ` It must be resolved within ${dLabel}.`;
        }
      }

      // ── Determine signal source (for explanation) ─────────────────────────
      const signalSource = hasExplicitCriticalSignal(item)
        ? "flagged via labels/tags"
        : "detected via content keywords";

      // ── Build suggested actions ───────────────────────────────────────────
      const suggestedActions: SuggestedAction[] = [
        {
          label: `Investigate "${item.title}" now`,
          rationale:
            `This is a critical, unresolved issue that has been open for ${ageLabel}${agePlural}. ` +
            `Immediate investigation is required to prevent further impact.`,
          targetItemId: item.id,
          actionUrl: item.url,
        },
        {
          label: "Assign an owner",
          rationale:
            "If the issue does not yet have a clear owner, assign one immediately to ensure accountability and avoid it falling through the cracks.",
          targetItemId: item.id,
          actionUrl: item.url,
        },
        {
          label: "Post a status update",
          rationale:
            "Keep stakeholders informed by posting a brief status update. Even a 'we are investigating' message reduces noise and prevents duplicate escalations.",
          targetItemId: item.id,
          actionUrl: item.url,
        },
      ];

      if (item.source === "github" || item.source === "slack") {
        suggestedActions.push({
          label: "Create an incident channel",
          rationale:
            "For production-impacting issues, creating a dedicated channel or war room ensures a focused response and a clear audit trail.",
          targetItemId: null,
        });
      }

      // ── Build explanation ─────────────────────────────────────────────────
      const explanation =
        `"${item.title}" is an unresolved critical issue (${signalSource}) that has been open ` +
        `for ${ageLabel}${agePlural} without resolution. ` +
        (item.mentionsUser
          ? `You were directly mentioned and are expected to act. `
          : isAssignedToUser(item, context)
          ? `You are assigned to this item and are the expected owner. `
          : `This issue falls within your priority scope and requires your attention. `) +
        `Critical issues left unresolved can cascade into broader outages, missed deadlines, ` +
        `and blocked downstream work.` +
        deadlineCtx;

      conflicts.push({
        id: generateConflictId("critical", item.id),
        kind: "critical_issue",
        type: "attention",
        items: [item],
        relatedItemIds: [item.id],
        description: `${displayName} has an unresolved critical issue: "${item.title}" (open for ${ageLabel}${agePlural}).`,
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
