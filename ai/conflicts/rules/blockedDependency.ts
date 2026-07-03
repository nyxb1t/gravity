/**
 * @file ai/conflicts/rules/blockedDependency.ts
 * @description Detects items with unresolved blocked dependencies.
 *
 * This rule detects two distinct dependency conflict scenarios:
 *
 * **Scenario A — Explicit blocker metadata:**
 *   An item has `metadata.isBlocked === true` or `metadata.isBlocker === true`.
 *   A blocked item with a deadline is especially high-severity because time is
 *   running out while the item cannot be progressed.
 *
 * **Scenario B — Cross-reference blocker chains:**
 *   An item's title or body references another item (by ID, issue number, or
 *   PR number) that is itself marked as `isBlocker`. The rule links the two
 *   items into a dependency conflict pair.
 *
 * The rule avoids false positives by only flagging items assigned to or
 * relevant to the current user, and by skipping already-closed items.
 *
 * No LLM. Pure metadata + text pattern inspection.
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
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * A deadline within this many hours causes a "blocked + deadline" conflict
 * to escalate to "critical" severity.
 */
const CRITICAL_DEADLINE_HOURS = 6;

/**
 * Tags (case-insensitive) that signal an item is a blocker.
 */
const BLOCKER_TAGS = new Set([
  "blocker",
  "blocking",
  "p0",
  "critical-blocker",
  "release-blocker",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the item is explicitly marked as a blocker (metadata or tag). */
function isBlocker(item: WorkspaceItem): boolean {
  if (item.metadata.isBlocker === true) return true;
  return item.tags.some((t) => BLOCKER_TAGS.has(t.toLowerCase()));
}

/** Returns true when the item is explicitly marked as blocked (metadata or tag). */
function isBlocked(item: WorkspaceItem): boolean {
  if (item.metadata.isBlocked === true) return true;
  return item.tags.some((t) => t.toLowerCase() === "blocked");
}

/**
 * Scans an item's title and body for references to another item's numeric ID.
 * Matches patterns like "#245", "issue:245", "pr:250", "PR #250".
 */
function referencesItem(candidate: WorkspaceItem, target: WorkspaceItem): boolean {
  // Extract the trailing numeric part of the target's ID.
  // e.g. "github:company/feature-x-repo:issue:245" → "245"
  const idMatch = target.id.match(/\d+$/);
  if (!idMatch) return false;

  const numericId = idMatch[0];
  const searchText = `${candidate.title} ${candidate.body}`;

  // Match #245, issue #245, issue:245, PR #250, pr:250, etc.
  const pattern = new RegExp(`(?:issue|pr|pull|#)\\s*#?${numericId}\\b`, "i");
  return pattern.test(searchText);
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const blockedDependencyRule: ConflictRule = {
  name: "BlockedDependencyRule",

  detect(items: WorkspaceItem[], context: RuleContext): DetectedConflict[] {
    const { nowMs } = context;
    const conflicts: DetectedConflict[] = [];
    const detectedAt = new Date(nowMs).toISOString();

    // Pre-compute: items that are active blockers.
    const activeBlockers = items.filter(
      (item) => isBlocker(item) && !isItemClosed(item)
    );

    // Track which (blocked, blocker) pairs we've already emitted to avoid dupes.
    const emitted = new Set<string>();

    // ── Scenario A: Explicit isBlocked flag ──────────────────────────────────
    for (const item of items) {
      if (!isBlocked(item)) continue;
      if (isItemClosed(item)) continue;
      // Only surface if the user is involved.
      if (!isAssignedToUser(item, context)) continue;

      // Try to find a specific blocker item that this references.
      const linkedBlocker = activeBlockers.find(
        (blocker) =>
          blocker.id !== item.id &&
          (referencesItem(item, blocker) || referencesItem(blocker, item))
      );

      const involvedItems = linkedBlocker ? [item, linkedBlocker] : [item];
      const pairKey = involvedItems
        .map((i) => i.id)
        .sort()
        .join("|");

      if (emitted.has(pairKey)) continue;
      emitted.add(pairKey);

      // ── Severity ───────────────────────────────────────────────────────────
      const deadlineMs = resolveDeadlineMs(item);
      let severity: DetectedConflict["severity"] = "high";

      if (deadlineMs !== null) {
        const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
        if (hoursLeft <= 0) {
          severity = "critical"; // Past deadline and still blocked.
        } else if (hoursLeft <= CRITICAL_DEADLINE_HOURS) {
          severity = "critical";
        }
      }

      // ── Description & explanation ──────────────────────────────────────────
      let deadlineCtx = "";
      if (deadlineMs !== null) {
        const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
        if (hoursLeft <= 0) {
          deadlineCtx = " Its deadline has already passed.";
        } else {
          const label =
            hoursLeft < 1
              ? `${Math.round(hoursLeft * 60)} min`
              : hoursLeft < 24
              ? `${Math.round(hoursLeft)} hr`
              : `${Math.round(hoursLeft / 24)} day`;
          const plural = parseFloat(label) !== 1 ? "s" : "";
          deadlineCtx = ` It is due in ${label}${plural}.`;
        }
      }

      const blockerRef = linkedBlocker
        ? `"${linkedBlocker.title}" (${linkedBlocker.source})`
        : "an unresolved blocker";

      const description = linkedBlocker
        ? `"${item.title}" is blocked by ${blockerRef}.${deadlineCtx}`
        : `"${item.title}" is marked as blocked by an unresolved dependency.${deadlineCtx}`;

      const explanation = linkedBlocker
        ? `Your item "${item.title}" cannot proceed because it depends on ${blockerRef}, ` +
          `which is still open and unresolved. Until the blocker is fixed, no progress ` +
          `can be made on the dependent item.${deadlineCtx}`
        : `"${item.title}" has been marked as blocked, meaning it has an unresolved ` +
          `upstream dependency preventing any further progress.${deadlineCtx} ` +
          `Identify and resolve the root blocker to unblock this item.`;

      // ── Suggested actions ─────────────────────────────────────────────────
      const suggestedActions: SuggestedAction[] = [];

      if (linkedBlocker) {
        suggestedActions.push({
          label: `Resolve "${linkedBlocker.title}"`,
          rationale: `Fixing the root blocker directly unblocks "${item.title}" and any other items depending on it.`,
          targetItemId: linkedBlocker.id,
          actionUrl: linkedBlocker.url,
        });
      }

      suggestedActions.push({
        label: `Escalate "${item.title}" to the team`,
        rationale:
          "If the blocker cannot be resolved immediately, escalate to the team lead so alternative approaches can be explored.",
        targetItemId: item.id,
        actionUrl: item.url,
      });

      suggestedActions.push({
        label: "Find a workaround",
        rationale:
          "Investigate whether a short-term workaround exists that lets work on the blocked item continue while the blocker is being resolved.",
        targetItemId: null,
      });

      conflicts.push({
        id: generateConflictId("dependency", ...involvedItems.map((i) => i.id)),
        kind: "blocked_dependency",
        type: "dependency",
        items: involvedItems,
        relatedItemIds: involvedItems.map((i) => i.id),
        description,
        explanation,
        severity,
        severityScore: SEVERITY_SCORE[severity],
        suggestedActions,
        detectedAt,
        acknowledged: false,
      });
    }

    // ── Scenario B: Active blockers with no dependents surfaced yet ──────────
    // Surface blocker items assigned to the user even if no explicit `isBlocked`
    // counterpart was found — the user should still know they're blocking others.
    for (const blocker of activeBlockers) {
      if (!isAssignedToUser(blocker, context) && !blocker.mentionsUser) continue;

      const pairKey = [blocker.id].sort().join("|");
      if (emitted.has(pairKey)) continue;
      emitted.add(pairKey);

      // Find items that appear to be waiting on this blocker.
      const dependents = items.filter(
        (item) =>
          item.id !== blocker.id &&
          !isItemClosed(item) &&
          (isBlocked(item) || referencesItem(item, blocker))
      );

      if (dependents.length === 0) continue; // No downstream impact detected.

      const dependentTitles = dependents
        .slice(0, 3)
        .map((d) => `"${d.title}"`)
        .join(", ");
      const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : "";

      const suggestedActions: SuggestedAction[] = [
        {
          label: `Fix "${blocker.title}"`,
          rationale: `Resolving this blocker immediately unblocks ${dependents.length} dependent item${dependents.length !== 1 ? "s" : ""}: ${dependentTitles}${moreCount}.`,
          targetItemId: blocker.id,
          actionUrl: blocker.url,
        },
        {
          label: "Provide a status update",
          rationale:
            "If the fix will take time, post a status update so blocked teams know what to expect and can plan accordingly.",
          targetItemId: blocker.id,
          actionUrl: blocker.url,
        },
      ];

      conflicts.push({
        id: generateConflictId("dependency", blocker.id, ...dependents.map((d) => d.id)),
        kind: "blocked_dependency",
        type: "dependency",
        items: [blocker, ...dependents],
        relatedItemIds: [blocker.id, ...dependents.map((d) => d.id)],
        description: `"${blocker.title}" is blocking ${dependents.length} downstream item${dependents.length !== 1 ? "s" : ""}: ${dependentTitles}${moreCount}.`,
        explanation:
          `"${blocker.title}" is an active blocker that is preventing ${dependents.length} ` +
          `other item${dependents.length !== 1 ? "s" : ""} from progressing: ${dependentTitles}${moreCount}. ` +
          `Until this issue is resolved, all dependent work remains stalled. ` +
          `You are involved in the blocker and should prioritise resolving it.`,
        severity: "high",
        severityScore: SEVERITY_SCORE.high,
        suggestedActions,
        detectedAt,
        acknowledged: false,
      });
    }

    return conflicts;
  },
};
