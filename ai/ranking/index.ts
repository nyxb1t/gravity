/**
 * @file ai/ranking/index.ts
 * @description Gravity Ranking Engine — public API.
 *
 * The single exported function `rankItems` accepts an array of NormalizedItem
 * objects and a UserContext, computes a GravityScore for every item, and
 * returns the items sorted from highest to lowest score.
 *
 * No AI. No I/O. Pure deterministic TypeScript.
 */

import type { NormalizedItem, UserContext, PriorityScore } from "@/types";

import {
  scoreRoleRelevance,
  scoreProjectRelevance,
  scoreDeadlineProximity,
  scoreDependencyStatus,
  scoreMentionSignal,
  scoreAssignmentSignal,
  scoreRecency,
  deriveUrgencyBand,
} from "./scorer";

import {
  DIMENSION_WEIGHTS,
  PRIORITY_SOURCE_BOOST,
  MUTED_SOURCE_PENALTY,
  QUIET_HOURS_PENALTY,
  RANKING_MODEL_VERSION,
} from "./weights";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A NormalizedItem enriched with its computed GravityScore and a transparent
 * breakdown of every signal that influenced the final number.
 */
export interface RankedItem {
  /** The original normalized item, unchanged. */
  item: NormalizedItem;

  /**
   * Fully populated PriorityScore — replaces or supplements `item.score`.
   * Callers can persist this back onto the item if desired.
   */
  score: PriorityScore;

  /**
   * Human-readable explanation tokens produced during scoring.
   * Suitable for display in a "why is this ranked here?" tooltip.
   * e.g. ["direct mention +0.12", "deadline in 2h +0.18", "muted source ×0.15"]
   */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Internal: weighted sum
// ---------------------------------------------------------------------------

interface DimensionScores {
  roleRelevance: number;
  projectRelevance: number;
  deadlineProximity: number;
  dependencyStatus: number;
  mentionSignal: number;
  assignmentSignal: number;
  recency: number;
}

/**
 * Computes the weighted sum of all dimension scores.
 *
 * Weights are normalised so that the total weight always sums to 1.0,
 * regardless of the raw values in DIMENSION_WEIGHTS. This means you can
 * add new dimensions or change individual weights without rescaling everything
 * else by hand.
 */
function weightedSum(dimensions: DimensionScores): number {
  const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce(
    (acc, w) => acc + w,
    0
  );

  const raw =
    dimensions.roleRelevance * DIMENSION_WEIGHTS.roleRelevance +
    dimensions.projectRelevance * DIMENSION_WEIGHTS.projectRelevance +
    dimensions.deadlineProximity * DIMENSION_WEIGHTS.deadlineProximity +
    dimensions.dependencyStatus * DIMENSION_WEIGHTS.dependencyStatus +
    dimensions.mentionSignal * DIMENSION_WEIGHTS.mentionSignal +
    dimensions.assignmentSignal * DIMENSION_WEIGHTS.assignmentSignal +
    dimensions.recency * DIMENSION_WEIGHTS.recency;

  return raw / totalWeight;
}

// ---------------------------------------------------------------------------
// Internal: quiet hours check
// ---------------------------------------------------------------------------

/**
 * Returns true when `nowMs` falls within the user's configured quiet-hour
 * window, taking the user's timezone into account.
 *
 * Supports windows that wrap midnight (e.g. 22:00 → 07:00).
 */
function isDuringQuietHours(context: UserContext, nowMs: number): boolean {
  if (!context.quietHours) return false;

  // Resolve the current local time in the user's timezone.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: context.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const localTime = formatter.format(new Date(nowMs)); // e.g. "22:30"
  const [nowHour, nowMin] = localTime.split(":").map(Number);
  const nowMinutes = nowHour * 60 + nowMin;

  const [startHour, startMin] = context.quietHours.start.split(":").map(Number);
  const [endHour, endMin] = context.quietHours.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes <= endMinutes) {
    // Window does not wrap midnight.
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Window wraps midnight (e.g. 22:00 → 07:00).
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

// ---------------------------------------------------------------------------
// Internal: post-score modifiers
// ---------------------------------------------------------------------------

interface Modifier {
  multiplier: number;
  reason: string;
}

/**
 * Computes all multiplicative post-score modifiers for an item.
 *
 * Modifiers are applied after the weighted sum so they act uniformly
 * on the total, not on individual dimensions.
 */
function resolveModifiers(
  item: NormalizedItem,
  context: UserContext,
  nowMs: number,
  hasMention: boolean
): Modifier[] {
  const { source, channel } = item.raw;
  const modifiers: Modifier[] = [];

  // Priority source boost.
  const sourceKey = channel ?? source;
  if (context.prioritySources.some(
    (s) => s.toLowerCase() === sourceKey?.toLowerCase() ||
           s.toLowerCase() === source.toLowerCase()
  )) {
    modifiers.push({
      multiplier: PRIORITY_SOURCE_BOOST,
      reason: `priority source ×${PRIORITY_SOURCE_BOOST.toFixed(2)}`,
    });
  }

  // Muted source penalty — waived when item directly mentions the user.
  if (
    !hasMention &&
    context.mutedSources.some(
      (s) => s.toLowerCase() === sourceKey?.toLowerCase() ||
             s.toLowerCase() === source.toLowerCase()
    )
  ) {
    modifiers.push({
      multiplier: MUTED_SOURCE_PENALTY,
      reason: `muted source ×${MUTED_SOURCE_PENALTY.toFixed(2)}`,
    });
  }

  // Quiet hours penalty — also waived for direct mentions.
  if (!hasMention && isDuringQuietHours(context, nowMs)) {
    modifiers.push({
      multiplier: QUIET_HOURS_PENALTY,
      reason: `quiet hours ×${QUIET_HOURS_PENALTY.toFixed(2)}`,
    });
  }

  return modifiers;
}

// ---------------------------------------------------------------------------
// Internal: reason building
// ---------------------------------------------------------------------------

/**
 * Converts a set of dimension scores into human-readable reason strings.
 *
 * Only signals that meaningfully contributed (score > 0) are emitted.
 */
function buildReasons(
  dimensions: DimensionScores,
  modifiers: Modifier[]
): string[] {
  const reasons: string[] = [];

  const fmt = (v: number) => v.toFixed(2);

  if (dimensions.mentionSignal > 0)
    reasons.push(`direct mention +${fmt(dimensions.mentionSignal * DIMENSION_WEIGHTS.mentionSignal)}`);
  if (dimensions.assignmentSignal > 0)
    reasons.push(`assigned +${fmt(dimensions.assignmentSignal * DIMENSION_WEIGHTS.assignmentSignal)}`);
  if (dimensions.deadlineProximity > 0)
    reasons.push(`deadline proximity +${fmt(dimensions.deadlineProximity * DIMENSION_WEIGHTS.deadlineProximity)}`);
  if (dimensions.dependencyStatus > 0)
    reasons.push(`dependency signal +${fmt(dimensions.dependencyStatus * DIMENSION_WEIGHTS.dependencyStatus)}`);
  if (dimensions.roleRelevance > 0)
    reasons.push(`role relevance +${fmt(dimensions.roleRelevance * DIMENSION_WEIGHTS.roleRelevance)}`);
  if (dimensions.projectRelevance > 0)
    reasons.push(`project relevance +${fmt(dimensions.projectRelevance * DIMENSION_WEIGHTS.projectRelevance)}`);
  if (dimensions.recency > 0)
    reasons.push(`recency +${fmt(dimensions.recency * DIMENSION_WEIGHTS.recency)}`);

  for (const mod of modifiers) {
    reasons.push(mod.reason);
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes a Gravity Score for every item and returns the list sorted from
 * highest to lowest score.
 *
 * @param items   - Array of NormalizedItem objects to rank.
 * @param context - UserContext for the requesting user.
 * @param nowMs   - Optional Unix epoch milliseconds for the current time.
 *                  Defaults to `Date.now()`. Pass an explicit value in tests
 *                  to make scoring fully deterministic.
 * @returns       - Array of RankedItem, sorted descending by `score.total`.
 */
export function rankItems(
  items: NormalizedItem[],
  context: UserContext,
  nowMs: number = Date.now()
): RankedItem[] {
  const scoredAt = new Date(nowMs).toISOString();

  const ranked: RankedItem[] = items.map((item) => {
    // ── 1. Compute each dimension ────────────────────────────────────────────
    const dimensions: DimensionScores = {
      roleRelevance: scoreRoleRelevance(item, context),
      projectRelevance: scoreProjectRelevance(item, context),
      deadlineProximity: scoreDeadlineProximity(item, nowMs),
      dependencyStatus: scoreDependencyStatus(item),
      mentionSignal: scoreMentionSignal(item, context),
      assignmentSignal: scoreAssignmentSignal(item, context),
      recency: scoreRecency(item, nowMs),
    };

    // ── 2. Weighted sum → base score [0, 1] ──────────────────────────────────
    const baseScore = weightedSum(dimensions);

    // ── 3. Apply post-score modifiers ────────────────────────────────────────
    const hasMention = item.raw.mentionsUser;
    const modifiers = resolveModifiers(item, context, nowMs, hasMention);

    const totalMultiplier = modifiers.reduce(
      (acc, mod) => acc * mod.multiplier,
      1.0
    );

    const total = Math.min(1.0, baseScore * totalMultiplier);

    // ── 4. Derive modifier values for the PriorityScore shape ────────────────
    const priorityBoost = modifiers
      .filter((m) => m.multiplier > 1)
      .reduce((acc, m) => acc * m.multiplier, 1.0);

    const quietPenalty = modifiers
      .filter((m) => m.multiplier < 1)
      .reduce((acc, m) => acc * m.multiplier, 1.0);

    // ── 5. Build PriorityScore ───────────────────────────────────────────────
    const score: PriorityScore = {
      total,
      urgency: deriveUrgencyBand(total),
      dimensions: {
        relevance: Math.max(dimensions.roleRelevance, dimensions.projectRelevance),
        urgencySignal: dimensions.deadlineProximity,
        recency: dimensions.recency,
        directAddressing: Math.max(dimensions.mentionSignal, dimensions.assignmentSignal),
        threadEngagement: dimensions.dependencyStatus,
        authorProximity: dimensions.assignmentSignal,
      },
      quietHoursPenalty: quietPenalty,
      prioritySourceBoost: priorityBoost,
      scoredAt,
      modelVersion: RANKING_MODEL_VERSION,
    };

    // ── 6. Build human-readable reasons ─────────────────────────────────────
    const reasons = buildReasons(dimensions, modifiers);

    return { item, score, reasons };
  });

  // ── 7. Sort descending by total score ────────────────────────────────────
  ranked.sort((a, b) => b.score.total - a.score.total);

  return ranked;
}
