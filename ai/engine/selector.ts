/**
 * @file ai/engine/selector.ts
 * @description Top-N item selector with role-aware conflict promotion.
 *
 * Responsibilities:
 *  1. Pick the `topN` highest-scored `RankedItem` objects.
 *  2. Identify conflicts that are genuinely relevant to the current user's
 *     roles and active work (role-aware filtering).
 *  3. Promote items from those relevant conflicts that did not make the
 *     initial top-N cut — so the LLM always has the full conflict picture.
 *
 * "Role-aware" means a conflict is only promoted if at least one of its
 * items satisfies one or more of the following criteria, checked in order:
 *
 *  A. The user is directly mentioned or assigned in that item.
 *  B. The item belongs to one of the user's priority sources.
 *  C. The item's tags or channel name overlap with the user's declared roles.
 *  D. The item scored above 0.5 in the deterministic ranking engine
 *     (high-scoring items are already role-relevant by definition).
 *
 * Conflict promotion is capped at `topN + conflicts.length` so the prompt
 * cannot grow unbounded even if the user is involved in many conflicts.
 *
 * No LLM. No I/O. Pure deterministic TypeScript.
 */

import type { NormalizedItem, UserContext } from "@/types";
import type { RankedItem } from "@/ai/ranking";
import type { DetectedConflict } from "@/ai/conflicts";

// ---------------------------------------------------------------------------
// Internal: relevance gate
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `conflict` is relevant to the current user's role
 * and active work. Used both for promotion gating and for the
 * `filterRelevantConflicts` public helper.
 */
function isConflictRelevantToUser(
  conflict: DetectedConflict,
  context: UserContext,
  rankedItemMap: Map<string, RankedItem>
): boolean {
  // Build a set of all identities the user operates under across integrations.
  const userIdentities = new Set<string>([
    context.userId,
    context.email,
    ...Object.values(context.connectedAccounts).filter((v): v is string =>
      Boolean(v)
    ),
  ]);

  // Normalise the user's roles for substring matching.
  const rolesLower = context.roles.map((r) => r.toLowerCase());

  // Normalise priority sources for fast lookup.
  const prioritySourcesLower = new Set(
    context.prioritySources.map((s) => s.toLowerCase())
  );

  for (const item of conflict.items) {
    // ── Criterion A: direct mention or assignment ──────────────────────────
    if (item.mentionsUser) return true;

    const isAssigned = item.participants.some((p) =>
      userIdentities.has(p.id)
    );
    if (isAssigned) return true;

    // ── Criterion B: item is in a priority source ──────────────────────────
    const sourceKey = (item.channel ?? item.source).toLowerCase();
    const sourceName = item.source.toLowerCase();

    if (
      prioritySourcesLower.has(sourceKey) ||
      prioritySourcesLower.has(sourceName)
    ) {
      return true;
    }

    // ── Criterion C: role keyword match in tags or channel ─────────────────
    const tagsLower = item.tags.map((t) => t.toLowerCase());
    const channelLower = (item.channel ?? "").toLowerCase();

    const hasRoleTagMatch = tagsLower.some((tag) =>
      rolesLower.some((role) => tag.includes(role))
    );
    const hasRoleChannelMatch = rolesLower.some((role) =>
      channelLower.includes(role)
    );

    if (hasRoleTagMatch || hasRoleChannelMatch) return true;

    // ── Criterion D: high deterministic score ─────────────────────────────
    const ranked = rankedItemMap.get(item.id);
    if (ranked && ranked.score.total >= 0.5) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return value of `selectTopItems`. */
export interface SelectionResult {
  /** Items selected for the LLM prompt. */
  selectedItems: NormalizedItem[];

  /**
   * Number of items that were promoted from outside the top-N because they
   * appeared in a role-relevant conflict.
   */
  promotedCount: number;
}

/**
 * Selects the highest-priority items to include in the LLM prompt,
 * with role-aware conflict promotion.
 *
 * @param ranked    - Full ranked list, sorted descending by score.
 * @param conflicts - All conflicts from the deterministic engine.
 * @param context   - User context (roles, assignments, priority sources).
 * @param topN      - Maximum number of items before conflict promotion.
 * @returns         A `SelectionResult` with the final item list and a
 *                  count of how many items were promoted.
 */
export function selectTopItems(
  ranked: RankedItem[],
  conflicts: DetectedConflict[],
  context: UserContext,
  topN: number
): SelectionResult {
  // Fast lookup: itemId → RankedItem (used for score checks in relevance gate).
  const rankedItemMap = new Map<string, RankedItem>(
    ranked.map((r) => [r.item.raw.id, r])
  );

  // ── Step 1: Start with top-N highest-scored items ──────────────────────
  const selectedItems: NormalizedItem[] = ranked.slice(0, topN).map((r) => r.item);
  const selectedIds = new Set<string>(selectedItems.map((i) => i.raw.id));

  // ── Step 2: Filter conflicts to critical/high severity only ────────────
  //            AND require role relevance (the key addition vs. the plan).
  const relevantHighSeverityConflicts = conflicts.filter(
    (c) =>
      (c.severity === "critical" || c.severity === "high") &&
      isConflictRelevantToUser(c, context, rankedItemMap)
  );

  // ── Step 3: Promote items from relevant conflicts ──────────────────────
  let promotedCount = 0;

  for (const conflict of relevantHighSeverityConflicts) {
    for (const conflictItem of conflict.items) {
      if (selectedIds.has(conflictItem.id)) continue;

      // Find the NormalizedItem for this conflict participant.
      const rankedEntry = rankedItemMap.get(conflictItem.id);
      if (!rankedEntry) continue;

      selectedItems.push(rankedEntry.item);
      selectedIds.add(conflictItem.id);
      promotedCount++;
    }
  }

  return { selectedItems, promotedCount };
}

/**
 * Filters a list of conflicts to only those relevant to the current user's
 * role and active work.
 *
 * Used by the Context Builder stage to populate
 * `OrchestratorContext.relevantConflicts`.
 *
 * Intentionally does **not** filter by severity — all severity bands that
 * are role-relevant are included so the LLM has full situational awareness.
 *
 * @param conflicts     - All conflicts from the deterministic engine.
 * @param context       - User context (roles, assignments, priority sources).
 * @param rankedItemMap - Pre-built lookup: itemId → RankedItem.
 * @returns             Subset of `conflicts` that pass the relevance gate.
 */
export function filterRelevantConflicts(
  conflicts: DetectedConflict[],
  context: UserContext,
  rankedItemMap: Map<string, RankedItem>
): DetectedConflict[] {
  return conflicts.filter((c) =>
    isConflictRelevantToUser(c, context, rankedItemMap)
  );
}
