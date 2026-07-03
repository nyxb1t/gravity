/**
 * @file ai/conflicts/engine.ts
 * @description Gravity Conflict Detection Engine — core orchestrator.
 *
 * `runConflictEngine` is the single entry point. It:
 *
 *  1. Extracts raw WorkspaceItems from the input NormalizedItems.
 *  2. Runs every registered ConflictRule against the item set.
 *  3. Deduplicates conflicts (same ID = same conflict, last writer wins).
 *  4. Sorts the final list by severity (critical → high → medium → low),
 *     then by `detectedAt` ascending within each band.
 *  5. Produces a `ConflictDetectionResult` envelope with summary stats.
 *
 * Rules are executed synchronously and sequentially. This is intentional:
 *  - Rules are pure functions — parallelism offers no benefit.
 *  - Sequential execution guarantees a stable, reproducible output order.
 *
 * To add a new rule, import it and add it to REGISTERED_RULES below.
 *
 * No LLM. No I/O. Pure deterministic TypeScript.
 */

import type { NormalizedItem, UserContext, WorkspaceItem } from "@/types";
import type {
  ConflictDetectionResult,
  ConflictRule,
  DetectedConflict,
  RuleContext,
} from "./types";

import { deadlineConflictRule } from "./rules/deadlineConflict";
import { missingApprovalRule } from "./rules/missingApproval";
import { blockedDependencyRule } from "./rules/blockedDependency";
import { criticalIssueRule } from "./rules/criticalIssue";
import { assignmentConflictRule } from "./rules/assignmentConflict";

// ---------------------------------------------------------------------------
// Engine metadata
// ---------------------------------------------------------------------------

/**
 * Semver version of the conflict engine.
 * Bump the patch version when changing rule thresholds (no new rules).
 * Bump the minor version when adding or removing rules.
 * Bump the major version for breaking changes to the output schema.
 */
export const CONFLICT_ENGINE_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

/**
 * All active conflict detection rules, in priority order.
 *
 * Rules are executed in this order — earlier rules run first. The order
 * does not affect correctness (rules are independent) but it does affect
 * which rule's conflict ID "wins" when two rules detect the same pair of
 * items (deduplication keeps the first occurrence).
 */
const REGISTERED_RULES: ConflictRule[] = [
  deadlineConflictRule,    // Schedule overlaps and deadline collisions
  blockedDependencyRule,   // Blocked dependencies and blocker chains
  missingApprovalRule,     // Pending approvals requiring user action
  criticalIssueRule,       // Unresolved critical issues in scope
  assignmentConflictRule,  // Simultaneous urgent assignments / sequencing traps
];

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/**
 * Converts a `UserContext` into the leaner `RuleContext` shape that rules
 * receive. Rules intentionally receive less context than the full UserContext
 * to keep the rule API minimal and future-proof.
 */
function buildRuleContext(
  userContext: UserContext,
  nowMs: number
): RuleContext & { prioritySources: string[] } {
  const connectedAccounts: Record<string, string> = {};
  for (const [source, id] of Object.entries(userContext.connectedAccounts)) {
    if (id) connectedAccounts[source] = id;
  }

  return {
    userId: userContext.userId,
    displayName: userContext.displayName,
    email: userContext.email,
    connectedAccounts,
    nowMs,
    // Pass prioritySources through for rules that need source-level relevance checks.
    prioritySources: userContext.prioritySources,
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicates a flat list of detected conflicts by their `id` field.
 *
 * When two rules produce a conflict with the same ID, the one that appears
 * FIRST in the array wins (earlier rules in REGISTERED_RULES take precedence).
 */
function deduplicateConflicts(
  conflicts: DetectedConflict[]
): DetectedConflict[] {
  const seen = new Map<string, DetectedConflict>();

  for (const conflict of conflicts) {
    if (!seen.has(conflict.id)) {
      seen.set(conflict.id, conflict);
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort comparator for DetectedConflict.
 *
 * Primary key:   severityScore descending (critical first).
 * Secondary key: detectedAt ascending (oldest conflict within same band first).
 * Tertiary key:  id ascending (stable, deterministic tie-break).
 */
function conflictComparator(a: DetectedConflict, b: DetectedConflict): number {
  // Primary: severity score descending.
  if (b.severityScore !== a.severityScore) {
    return b.severityScore - a.severityScore;
  }

  // Secondary: detectedAt ascending (earlier detection first).
  const aTime = new Date(a.detectedAt).getTime();
  const bTime = new Date(b.detectedAt).getTime();
  if (aTime !== bTime) return aTime - bTime;

  // Tertiary: lexicographic ID (pure tie-break for stable ordering).
  return a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  conflicts: DetectedConflict[]
): ConflictDetectionResult["summary"] {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of conflicts) {
    if (c.severity === "critical") summary.critical++;
    else if (c.severity === "high") summary.high++;
    else if (c.severity === "medium") summary.medium++;
    else summary.low++;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full Gravity Conflict Detection Engine against a set of workspace
 * items and a user context.
 *
 * @param items   - Normalized workspace items (the pipeline's output). The
 *                  engine reads `item.raw` — score and conflict arrays are
 *                  ignored as inputs (they are outputs of this function).
 * @param context - The full UserContext for the requesting user.
 * @param nowMs   - Unix epoch milliseconds for "now". Pass an explicit value
 *                  in tests to ensure deterministic output. Defaults to
 *                  `Date.now()`.
 *
 * @returns A `ConflictDetectionResult` with all detected conflicts sorted by
 *          severity, plus summary statistics.
 */
export function runConflictEngine(
  items: NormalizedItem[],
  context: UserContext,
  nowMs: number = Date.now()
): ConflictDetectionResult {
  // ── 1. Extract raw WorkspaceItems ─────────────────────────────────────────
  const rawItems: WorkspaceItem[] = items.map((item) => item.raw);

  // ── 2. Build the leaner RuleContext ──────────────────────────────────────
  const ruleContext = buildRuleContext(context, nowMs);

  // ── 3. Run all registered rules ───────────────────────────────────────────
  const allConflicts: DetectedConflict[] = [];

  for (const rule of REGISTERED_RULES) {
    let ruleConflicts: DetectedConflict[];

    try {
      ruleConflicts = rule.detect(rawItems, ruleContext);
    } catch (err) {
      // Defensive: a buggy rule must never crash the engine.
      // Log and continue so other rules still run.
      console.error(
        `[ConflictEngine] Rule "${rule.name}" threw an error and was skipped:`,
        err
      );
      continue;
    }

    allConflicts.push(...ruleConflicts);
  }

  // ── 4. Deduplicate ────────────────────────────────────────────────────────
  const unique = deduplicateConflicts(allConflicts);

  // ── 5. Sort ───────────────────────────────────────────────────────────────
  unique.sort(conflictComparator);

  // ── 6. Build result ───────────────────────────────────────────────────────
  return {
    conflicts: unique,
    total: unique.length,
    summary: buildSummary(unique),
    detectedAt: new Date(nowMs).toISOString(),
    engineVersion: CONFLICT_ENGINE_VERSION,
  };
}

/**
 * Convenience overload that accepts raw WorkspaceItems directly instead of
 * NormalizedItems. Useful in integration tests and adapters that haven't
 * gone through the full normalization pipeline yet.
 *
 * @param rawItems - Raw WorkspaceItems from any source adapter.
 * @param context  - The full UserContext for the requesting user.
 * @param nowMs    - Reference timestamp (defaults to `Date.now()`).
 */
export function runConflictEngineRaw(
  rawItems: WorkspaceItem[],
  context: UserContext,
  nowMs: number = Date.now()
): ConflictDetectionResult {
  // Wrap raw items into minimal NormalizedItems so we can reuse the main API.
  const wrapped: NormalizedItem[] = rawItems.map((raw) => ({
    raw,
    conflicts: [],
    isRead: false,
    isBookmarked: false,
    firstSeenAt: null,
    lastProcessedAt: new Date(nowMs).toISOString(),
  }));

  return runConflictEngine(wrapped, context, nowMs);
}
