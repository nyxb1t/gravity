/**
 * @file ai/ranking/scorer.ts
 * @description Pure, stateless scoring functions for each Gravity dimension.
 *
 * Each function takes a NormalizedItem and a UserContext (plus the current
 * timestamp) and returns a number in [0, 1] representing that dimension's
 * contribution.
 *
 * No side effects. No AI. No network calls. Purely deterministic math.
 */

import type { NormalizedItem, UserContext, UrgencyBand } from "@/types";
import {
  ROLE_EXACT_MATCH_SCORE,
  ROLE_PARTIAL_MATCH_SCORE,
  ROLE_NO_MATCH_SCORE,
  PROJECT_EXACT_MATCH_SCORE,
  PROJECT_PARTIAL_MATCH_SCORE,
  PROJECT_NO_MATCH_SCORE,
  DEADLINE_CRITICAL_HOURS,
  DEADLINE_DECAY_START_HOURS,
  DEADLINE_OVERDUE_SCORE,
  DEADLINE_NONE_SCORE,
  DEPENDENCY_IS_BLOCKER_SCORE,
  DEPENDENCY_IS_BLOCKED_SCORE,
  DEPENDENCY_NONE_SCORE,
  MENTION_DIRECT_SCORE,
  MENTION_UNSTRUCTURED_SCORE,
  MENTION_NONE_SCORE,
  ASSIGNMENT_PRIMARY_SCORE,
  ASSIGNMENT_SECONDARY_SCORE,
  ASSIGNMENT_NONE_SCORE,
  RECENCY_HALF_LIFE_HOURS,
  RECENCY_FLOOR,
  URGENCY_THRESHOLDS,
} from "./weights";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a number to [0, 1].
 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Returns the number of hours between a reference date and now.
 * Positive → event is in the future.
 * Negative → event is in the past.
 */
function hoursUntil(isoTimestamp: string, nowMs: number): number {
  return (new Date(isoTimestamp).getTime() - nowMs) / (1000 * 60 * 60);
}

/**
 * Returns true when `haystack` contains `needle` as a case-insensitive
 * whole-word (or word-segment) match.
 */
function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// 1. Role Relevance
// ---------------------------------------------------------------------------

/**
 * Scores how relevant an item is to the user's declared roles.
 *
 * Algorithm:
 *  - Exact match: any role appears verbatim in item tags → 1.0
 *  - Partial match: any role appears in title or body text → 0.5
 *  - No match → 0.0
 *
 * The highest match level found across all roles wins.
 */
export function scoreRoleRelevance(
  item: NormalizedItem,
  context: UserContext
): number {
  if (context.roles.length === 0) return ROLE_NO_MATCH_SCORE;

  const { tags, title, body } = item.raw;
  const tagsLower = tags.map((t) => t.toLowerCase());
  const searchText = `${title} ${body}`.toLowerCase();

  let best = ROLE_NO_MATCH_SCORE;

  for (const role of context.roles) {
    const roleLower = role.toLowerCase();

    if (tagsLower.includes(roleLower)) {
      // Short-circuit — can't do better than exact.
      return ROLE_EXACT_MATCH_SCORE;
    }

    if (best < ROLE_PARTIAL_MATCH_SCORE && containsInsensitive(searchText, roleLower)) {
      best = ROLE_PARTIAL_MATCH_SCORE;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// 2. Project Relevance
// ---------------------------------------------------------------------------

/**
 * Scores how relevant an item is to the user's active projects/priority sources.
 *
 * Algorithm:
 *  - Exact match: item's channel or tags exactly match a priority source → 1.0
 *  - Partial match: priority source keyword appears in title or body → 0.4
 *  - No match → 0.0
 */
export function scoreProjectRelevance(
  item: NormalizedItem,
  context: UserContext
): number {
  if (context.prioritySources.length === 0) return PROJECT_NO_MATCH_SCORE;

  const { channel, tags, title, body } = item.raw;
  const tagsAndChannel = [
    ...tags.map((t) => t.toLowerCase()),
    ...(channel ? [channel.toLowerCase()] : []),
  ];
  const searchText = `${title} ${body}`.toLowerCase();

  let best = PROJECT_NO_MATCH_SCORE;

  for (const source of context.prioritySources) {
    const sourceLower = source.toLowerCase();

    if (tagsAndChannel.includes(sourceLower)) {
      return PROJECT_EXACT_MATCH_SCORE;
    }

    if (best < PROJECT_PARTIAL_MATCH_SCORE && containsInsensitive(searchText, sourceLower)) {
      best = PROJECT_PARTIAL_MATCH_SCORE;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// 3. Deadline Proximity
// ---------------------------------------------------------------------------

/**
 * Scores deadline urgency using a piecewise function:
 *
 *  hours < 0 (overdue)         → 1.0
 *  hours in [0, critical)      → 1.0
 *  hours in [critical, decay)  → linear decay from 1.0 → 0.0
 *  hours >= decay              → 0.0
 *  no deadline                 → 0.0
 *
 * The deadline is read from `item.raw.metadata.dueDate` (ISO 8601 string)
 * or from a calendar event's `metadata.eventEnd`.
 */
export function scoreDeadlineProximity(
  item: NormalizedItem,
  nowMs: number
): number {
  const { metadata, kind } = item.raw;

  // Resolve the deadline from common metadata keys.
  const deadlineIso =
    (metadata.dueDate as string | undefined) ??
    (kind === "event" ? (metadata.eventEnd as string | undefined) : undefined);

  if (!deadlineIso) return DEADLINE_NONE_SCORE;

  const hoursLeft = hoursUntil(deadlineIso, nowMs);

  if (hoursLeft <= 0) return DEADLINE_OVERDUE_SCORE;
  if (hoursLeft < DEADLINE_CRITICAL_HOURS) return 1.0;
  if (hoursLeft >= DEADLINE_DECAY_START_HOURS) return 0.0;

  // Linear decay between DEADLINE_CRITICAL_HOURS and DEADLINE_DECAY_START_HOURS.
  const decayRange = DEADLINE_DECAY_START_HOURS - DEADLINE_CRITICAL_HOURS;
  const hoursIntoDecay = hoursLeft - DEADLINE_CRITICAL_HOURS;
  return clamp01(1.0 - hoursIntoDecay / decayRange);
}

// ---------------------------------------------------------------------------
// 4. Dependency / Blocker Status
// ---------------------------------------------------------------------------

/**
 * Scores an item based on its dependency relationships.
 *
 * Reads from `item.raw.metadata`:
 *  - `isBlocker: boolean`  → item is blocking other work
 *  - `isBlocked: boolean`  → item has unresolved blockers
 *
 * An item that is both a blocker and blocked scores as a blocker
 * (the more actionable signal wins).
 */
export function scoreDependencyStatus(item: NormalizedItem): number {
  const { metadata } = item.raw;

  if (metadata.isBlocker === true) return DEPENDENCY_IS_BLOCKER_SCORE;
  if (metadata.isBlocked === true) return DEPENDENCY_IS_BLOCKED_SCORE;
  return DEPENDENCY_NONE_SCORE;
}

// ---------------------------------------------------------------------------
// 5. Mention Signal
// ---------------------------------------------------------------------------

/**
 * Scores whether the user is mentioned in the item.
 *
 * Priority order (highest wins):
 *  1. `item.raw.mentionsUser === true`                   → 1.0  (structured mention)
 *  2. User's display name found in title or body text   → 0.5  (unstructured)
 *  3. No mention                                         → 0.0
 */
export function scoreMentionSignal(
  item: NormalizedItem,
  context: UserContext
): number {
  if (item.raw.mentionsUser) return MENTION_DIRECT_SCORE;

  const searchText = `${item.raw.title} ${item.raw.body}`.toLowerCase();

  if (
    containsInsensitive(searchText, context.displayName) ||
    containsInsensitive(searchText, context.email.split("@")[0])
  ) {
    return MENTION_UNSTRUCTURED_SCORE;
  }

  return MENTION_NONE_SCORE;
}

// ---------------------------------------------------------------------------
// 6. Assignment Signal
// ---------------------------------------------------------------------------

/**
 * Scores whether the user is assigned to this item.
 *
 * Priority order (highest wins):
 *  1. User appears in participants with role "assignee"      → 1.0
 *  2. Author is the user themselves (self-created items)     → 1.0
 *  3. User appears as reviewer / attendee / participant      → 0.5
 *  4. No relationship                                        → 0.0
 *
 * Matching is performed against:
 *  - `UserContext.connectedAccounts[source]` (provider-native ID)
 *  - `UserContext.email`
 *  - `UserContext.userId`
 */
export function scoreAssignmentSignal(
  item: NormalizedItem,
  context: UserContext
): number {
  const { source, author, participants } = item.raw;
  const providerUserId = context.connectedAccounts[source];

  const isUser = (id: string): boolean =>
    id === context.userId ||
    id === context.email ||
    (providerUserId !== undefined && id === providerUserId);

  // Check author.
  if (author !== null && isUser(author.id)) return ASSIGNMENT_PRIMARY_SCORE;

  // Walk participants.
  let best = ASSIGNMENT_NONE_SCORE;

  for (const participant of participants) {
    if (!isUser(participant.id)) continue;

    if (participant.role === "assignee") {
      return ASSIGNMENT_PRIMARY_SCORE; // Can't do better.
    }

    best = ASSIGNMENT_SECONDARY_SCORE;
  }

  return best;
}

// ---------------------------------------------------------------------------
// 7. Recency
// ---------------------------------------------------------------------------

/**
 * Scores how recent the item is using exponential decay.
 *
 * Formula: max(RECENCY_FLOOR, 2^(-age_hours / RECENCY_HALF_LIFE_HOURS))
 *
 * - A brand-new item scores ≈ 1.0.
 * - An item created exactly RECENCY_HALF_LIFE_HOURS ago scores 0.5.
 * - Score never falls below RECENCY_FLOOR.
 *
 * If `updatedAt` is available it takes precedence over `createdAt`,
 * since a recently-edited item is still active.
 */
export function scoreRecency(item: NormalizedItem, nowMs: number): number {
  const timestamp = item.raw.updatedAt ?? item.raw.createdAt;
  const ageHours = (nowMs - new Date(timestamp).getTime()) / (1000 * 60 * 60);
  const decayed = Math.pow(2, -ageHours / RECENCY_HALF_LIFE_HOURS);
  return Math.max(RECENCY_FLOOR, clamp01(decayed));
}

// ---------------------------------------------------------------------------
// UrgencyBand derivation
// ---------------------------------------------------------------------------

/**
 * Maps a normalised [0, 1] Gravity Score to a coarse UrgencyBand.
 * Thresholds are checked in descending order.
 */
export function deriveUrgencyBand(score: number): UrgencyBand {
  if (score >= URGENCY_THRESHOLDS.critical) return "critical";
  if (score >= URGENCY_THRESHOLDS.high) return "high";
  if (score >= URGENCY_THRESHOLDS.medium) return "medium";
  return "low";
}
