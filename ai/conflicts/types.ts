/**
 * @file ai/conflicts/types.ts
 * @description Extended conflict types for the Gravity Conflict Detection Engine.
 *
 * `DetectedConflict` is a superset of the base `Conflict` interface defined in
 * `types/index.ts`. It carries the richer payload produced by the engine:
 * a structured explanation, a concrete suggested action, and the full list of
 * related item IDs so consumers can cross-reference without re-querying.
 *
 * No business logic lives here — only data contracts.
 */

import type { Conflict, UrgencyBand, WorkspaceItem } from "@/types";

// ---------------------------------------------------------------------------
// Conflict kind registry
// ---------------------------------------------------------------------------

/**
 * Enumeration of every conflict class the engine can detect.
 *
 * Kept as a string union (not a TypeScript enum) for JSON-serialisability
 * and to remain compatible with the base `Conflict.type` field.
 *
 * The five classes map to the five detection rules:
 *  - conflicting_deadlines   → two or more items with overlapping/clashing due dates
 *  - missing_approval        → an item awaiting sign-off before it can proceed
 *  - blocked_dependency      → an item is blocked by another unresolved item
 *  - critical_issue          → a single item is flagged as critical with no resolution
 *  - assignment_conflict     → the same person is over-assigned across simultaneous items
 */
export type ConflictKind =
  | "conflicting_deadlines"
  | "missing_approval"
  | "blocked_dependency"
  | "critical_issue"
  | "assignment_conflict";

// ---------------------------------------------------------------------------
// SuggestedAction
// ---------------------------------------------------------------------------

/**
 * A concrete, actionable recommendation attached to a conflict.
 *
 * The engine always produces at least one suggestion per conflict so that
 * consumers never need to derive next steps from the description alone.
 */
export interface SuggestedAction {
  /**
   * Short imperative label suitable for a button or inline tooltip.
   * e.g. "Decline All-Hands invite", "Resolve blocker issue #245", "Approve spec"
   */
  label: string;

  /**
   * Longer prose explaining why this action resolves or mitigates the conflict.
   * Written in second person. Safe to display directly to the user.
   */
  rationale: string;

  /**
   * The item this action should be performed on.
   * `null` when the action is general (e.g. "reach out to team").
   */
  targetItemId: string | null;

  /**
   * Optional deep-link URL to perform the action in the source application.
   * Populated when the source provides a stable action URL.
   */
  actionUrl?: string;
}

// ---------------------------------------------------------------------------
// DetectedConflict
// ---------------------------------------------------------------------------

/**
 * A single conflict surfaced by the Gravity Conflict Detection Engine.
 *
 * Extends the base `Conflict` type with engine-generated fields that make
 * the conflict immediately actionable without further processing.
 *
 * All fields inherited from `Conflict`:
 *  - id, type, items, description, severity, detectedAt, acknowledged
 */
export interface DetectedConflict extends Conflict {
  /**
   * The specific conflict class as detected by the engine.
   * More granular than the base `Conflict.type` field which uses broad buckets.
   */
  kind: ConflictKind;

  /**
   * A structured, user-facing explanation of why this is a conflict.
   *
   * Differs from `description` (which is a one-liner) in that `explanation`
   * provides the full causal chain:
   *  - what is in conflict
   *  - why it matters
   *  - what the impact is if left unresolved
   */
  explanation: string;

  /**
   * One or more concrete actions the user can take to resolve or mitigate
   * this conflict. Ordered from most to least impactful.
   */
  suggestedActions: SuggestedAction[];

  /**
   * The IDs of all WorkspaceItems involved in this conflict.
   * Mirrors `Conflict.items.map(i => i.id)` but kept as a flat list for
   * O(1) membership checks in downstream filters.
   */
  relatedItemIds: string[];

  /**
   * Stable numeric score in [0, 1] representing how severe this conflict is.
   *
   * Derived deterministically from the `severity` band:
   *  critical → 1.0 | high → 0.75 | medium → 0.5 | low → 0.25
   *
   * Useful for sorting multiple conflicts when all share the same severity band.
   */
  severityScore: number;
}

// ---------------------------------------------------------------------------
// ConflictDetectionResult
// ---------------------------------------------------------------------------

/**
 * The complete output of a single conflict detection pass.
 *
 * Returned by `detectConflicts()` and surfaced at the API level inside
 * `GravityResponse.conflicts`.
 */
export interface ConflictDetectionResult {
  /**
   * All conflicts found, sorted by `severityScore` descending then by
   * `detectedAt` ascending (oldest first within the same severity band).
   */
  conflicts: DetectedConflict[];

  /**
   * Total number of conflicts detected (equals `conflicts.length`).
   * Provided as a convenience so consumers can gate UI elements without
   * iterating the array.
   */
  total: number;

  /**
   * Breakdown of how many conflicts exist per severity band.
   * Useful for summary badges (e.g. "3 critical, 1 high").
   */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  /**
   * ISO 8601 UTC timestamp of when this detection pass completed.
   */
  detectedAt: string;

  /**
   * Semver version of the conflict engine that produced this result.
   * Used to invalidate stale results after rule changes.
   */
  engineVersion: string;
}

// ---------------------------------------------------------------------------
// Internal rule interface
// ---------------------------------------------------------------------------

/**
 * Contract that every conflict detection rule must satisfy.
 *
 * Rules are pure functions: given items and context they return zero or more
 * `DetectedConflict` objects. No side effects. No I/O. No randomness.
 *
 * @internal — not exported from the module's public surface.
 */
export interface ConflictRule {
  /**
   * Human-readable name for the rule (used in logging and the engine version).
   * e.g. "DeadlineConflictRule"
   */
  readonly name: string;

  /**
   * Execute the rule against the provided items and context.
   *
   * @param items  - Full set of normalised workspace items.
   * @param context - Lightweight context object (user identity + now timestamp).
   * @returns       Array of detected conflicts (may be empty).
   */
  detect(items: WorkspaceItem[], context: RuleContext): DetectedConflict[];
}

// ---------------------------------------------------------------------------
// RuleContext
// ---------------------------------------------------------------------------

/**
 * Lightweight context object passed into every rule.
 *
 * Intentionally minimal — rules only need identity information and a stable
 * "now" timestamp to remain deterministic.
 */
export interface RuleContext {
  /** Stable user identifier for matching assignments and participants. */
  userId: string;

  /** Display name for building human-readable explanations. */
  displayName: string;

  /** Primary email — matched against calendar attendees and mentions. */
  email: string;

  /**
   * Provider-specific user IDs keyed by DataSource.
   * Mirrors `UserContext.connectedAccounts`.
   */
  connectedAccounts: Record<string, string>;

  /**
   * Unix epoch milliseconds for "now".
   * Passed in (never derived from `Date.now()` inside rules) so the engine
   * is always deterministic in tests.
   */
  nowMs: number;
}

// ---------------------------------------------------------------------------
// Utility: severity → numeric score
// ---------------------------------------------------------------------------

/**
 * Maps an UrgencyBand to a deterministic numeric severity score in [0, 1].
 * Used to produce a stable sort order when multiple conflicts share the same
 * severity band.
 */
export const SEVERITY_SCORE: Record<UrgencyBand, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.50,
  low: 0.25,
  dismissed: 0.0,
} as const;
