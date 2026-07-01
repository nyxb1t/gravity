/**
 * @file ai/ranking/weights.ts
 * @description All tunable constants for the Gravity Ranking Engine.
 *
 * Every number that influences a score lives here — never inline.
 * Adjust these values to recalibrate the engine without touching
 * any scoring logic.
 */

// ---------------------------------------------------------------------------
// Dimension Weights
// ---------------------------------------------------------------------------

/**
 * Relative weight of each scoring dimension.
 * Values do not need to sum to 1.0 — they are normalised internally
 * before producing the final [0, 1] Gravity Score.
 *
 * Increase a weight to make that signal more dominant.
 */
export const DIMENSION_WEIGHTS = {
  /** How relevant the item is to the user's active role(s). */
  roleRelevance: 0.20,

  /** How relevant the item is to the user's active project. */
  projectRelevance: 0.20,

  /** Urgency derived from how close the deadline / due date is. */
  deadlineProximity: 0.18,

  /**
   * Penalty signal for items blocked by unresolved dependencies,
   * or boost for items that are actively blocking others.
   */
  dependencyStatus: 0.12,

  /** Direct @-mentions of the user anywhere in the item. */
  mentionSignal: 0.12,

  /** Whether the user is explicitly assigned to this item. */
  assignmentSignal: 0.10,

  /** How recently the item was created or last updated. */
  recency: 0.08,
} as const;

// ---------------------------------------------------------------------------
// Role Relevance
// ---------------------------------------------------------------------------

/** Score boost when the item's tags / channel exactly match a user role. */
export const ROLE_EXACT_MATCH_SCORE = 1.0;

/** Score boost when a user role appears as a substring of the item's title or body. */
export const ROLE_PARTIAL_MATCH_SCORE = 0.5;

/** Score when no role signal can be detected. */
export const ROLE_NO_MATCH_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Project Relevance
// ---------------------------------------------------------------------------

/**
 * Full score when the item's channel or tags exactly match an active project
 * in `UserContext.prioritySources`.
 */
export const PROJECT_EXACT_MATCH_SCORE = 1.0;

/** Partial score when the item's title or body references an active project keyword. */
export const PROJECT_PARTIAL_MATCH_SCORE = 0.4;

/** Score when no project signal can be detected. */
export const PROJECT_NO_MATCH_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Deadline Proximity
// ---------------------------------------------------------------------------

/**
 * Hours before deadline at which urgency reaches its maximum (1.0).
 * Any item due within this window scores 1.0 on deadline proximity.
 */
export const DEADLINE_CRITICAL_HOURS = 4;

/**
 * Hours before deadline at which urgency starts decaying from 1.0.
 * Items due between DEADLINE_CRITICAL_HOURS and DEADLINE_DECAY_START_HOURS
 * receive a linearly decayed score.
 */
export const DEADLINE_DECAY_START_HOURS = 48;

/**
 * Hours past the deadline at which the item is considered fully overdue.
 * Overdue items receive the maximum proximity score (1.0) regardless.
 */
export const DEADLINE_OVERDUE_SCORE = 1.0;

/** Score for items with no deadline information. */
export const DEADLINE_NONE_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Dependency / Blocker Status
// ---------------------------------------------------------------------------

/**
 * Score for an item that is actively blocking other items.
 * Blockers deserve more attention — they unblock other people's work.
 */
export const DEPENDENCY_IS_BLOCKER_SCORE = 1.0;

/** Score for an item that has open blockers itself (it is blocked). */
export const DEPENDENCY_IS_BLOCKED_SCORE = 0.3;

/** Score for an item with no dependency relationships. */
export const DEPENDENCY_NONE_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Mention Signal
// ---------------------------------------------------------------------------

/** Full score when the item directly @-mentions the user. */
export const MENTION_DIRECT_SCORE = 1.0;

/** Partial score when the user's display name appears in the body (unstructured mention). */
export const MENTION_UNSTRUCTURED_SCORE = 0.5;

/** Score when the user is not mentioned. */
export const MENTION_NONE_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Assignment Signal
// ---------------------------------------------------------------------------

/** Full score when the user is the primary assignee of the item. */
export const ASSIGNMENT_PRIMARY_SCORE = 1.0;

/** Partial score when the user is a reviewer, attendee, or secondary participant. */
export const ASSIGNMENT_SECONDARY_SCORE = 0.5;

/** Score when the user has no assignment relationship to the item. */
export const ASSIGNMENT_NONE_SCORE = 0.0;

// ---------------------------------------------------------------------------
// Recency (Exponential Decay)
// ---------------------------------------------------------------------------

/**
 * Half-life of the recency signal in hours.
 * An item created exactly RECENCY_HALF_LIFE_HOURS ago scores 0.5.
 * A brand-new item scores 1.0.
 */
export const RECENCY_HALF_LIFE_HOURS = 6;

/**
 * Floor below which recency will not decay further.
 * Prevents very old items from scoring absolute zero on this dimension.
 */
export const RECENCY_FLOOR = 0.05;

// ---------------------------------------------------------------------------
// Post-Score Modifiers
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to the final score when the item's source is in
 * `UserContext.prioritySources`. Must be >= 1.0.
 */
export const PRIORITY_SOURCE_BOOST = 1.25;

/**
 * Multiplier applied to the final score when the item's source is in
 * `UserContext.mutedSources` and there is no direct mention.
 * Must be in (0, 1).
 */
export const MUTED_SOURCE_PENALTY = 0.15;

/**
 * Multiplier applied during the user's quiet-hour window
 * (unless the item is a direct mention).
 * Must be in (0, 1).
 */
export const QUIET_HOURS_PENALTY = 0.20;

// ---------------------------------------------------------------------------
// UrgencyBand Thresholds
// ---------------------------------------------------------------------------

/**
 * Maps a normalised [0, 1] Gravity Score to a coarse UrgencyBand.
 * Thresholds are inclusive lower bounds checked in descending order.
 */
export const URGENCY_THRESHOLDS = {
  critical: 0.80,
  high: 0.60,
  medium: 0.35,
  low: 0.0,
} as const;

// ---------------------------------------------------------------------------
// Engine Metadata
// ---------------------------------------------------------------------------

/** Semver identifier embedded in every PriorityScore for cache invalidation. */
export const RANKING_MODEL_VERSION = "1.0.0";
