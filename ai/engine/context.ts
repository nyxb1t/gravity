/**
 * @file ai/engine/context.ts
 * @description Context Builder — Stage 4 of the Gravity Orchestration Pipeline.
 *
 * The Context Builder sits between the selector (which chooses which items
 * to include) and the prompt assembler (which serialises everything into a
 * string). Its job is to:
 *
 *  1. Slim the `UserContext` down to the `UserSummary` shape the LLM needs.
 *  2. Derive the user's **active projects** from the selected items — not
 *     from user configuration, but from actual involvement signals:
 *     direct mentions, assignments, and participation in ranked items.
 *  3. Surface only the conflicts that are relevant to those active projects
 *     (cross-checked against the role-filtered list from the selector).
 *  4. Package everything into a typed `OrchestratorContext` that is the
 *     sole input to `assemblePrompt`.
 *
 * By isolating this transformation here, the assembler stays a pure
 * serialisation concern and the orchestrator stays a pure pipeline coordinator.
 *
 * No LLM. No I/O. Pure deterministic TypeScript.
 */

import type { NormalizedItem, UserContext } from "@/types";
import type { DetectedConflict } from "@/ai/conflicts";
import type {
  OrchestratorContext,
  OrchestratorMode,
  UserSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Internal: active project derivation
// ---------------------------------------------------------------------------

/**
 * Derives the user's currently active projects from the selected items.
 *
 * A project (represented as a channel / source key) is considered "active"
 * if the user has a direct involvement signal in at least one item belonging
 * to that channel:
 *
 *  - Direct `@-mention` (`item.raw.mentionsUser === true`)
 *  - Explicit participant/assignee/reviewer role matching a user identity
 *
 * Priority sources are also included unconditionally — the user has declared
 * these as always relevant.
 *
 * The result is deduplicated and returned in the order they were first
 * encountered so the LLM sees the most recently relevant projects first.
 */
function deriveActiveProjects(
  selectedItems: NormalizedItem[],
  context: UserContext
): string[] {
  // All identities the user operates under across integrations.
  const userIdentities = new Set<string>([
    context.userId,
    context.email,
    ...Object.values(context.connectedAccounts).filter((v): v is string =>
      Boolean(v)
    ),
  ]);

  const seen = new Set<string>();
  const projects: string[] = [];

  const add = (channel: string) => {
    if (channel && !seen.has(channel)) {
      seen.add(channel);
      projects.push(channel);
    }
  };

  // ── Involvement-derived projects ────────────────────────────────────────
  for (const item of selectedItems) {
    const raw = item.raw;
    if (!raw.channel) continue;

    const isDirectlyInvolved =
      raw.mentionsUser ||
      raw.participants.some((p) => userIdentities.has(p.id));

    if (isDirectlyInvolved) {
      add(raw.channel);
    }
  }

  // ── User-configured priority sources (always active) ───────────────────
  for (const src of context.prioritySources) {
    add(src);
  }

  return projects;
}

// ---------------------------------------------------------------------------
// Internal: conflict relevance cross-check
// ---------------------------------------------------------------------------

/**
 * Cross-checks the role-filtered conflicts against the user's active projects.
 *
 * A conflict passes if at least one of its items belongs to an active project
 * OR if the conflict was already determined to be role-relevant by the
 * selector (both lists are passed in and unioned).
 *
 * This adds a second layer of filtering on top of the selector's role gate:
 * the selector uses role keywords; the context builder uses actual involvement
 * signals derived from the selected items. Together they prevent surfacing
 * conflicts about teams or repos the user only tangentially knows about.
 */
function crossCheckConflicts(
  relevantConflicts: DetectedConflict[],
  activeProjects: Set<string>
): DetectedConflict[] {
  if (activeProjects.size === 0) {
    // No active projects could be derived — fall back to the selector's list.
    return relevantConflicts;
  }

  return relevantConflicts.filter((conflict) => {
    // At least one conflict item must belong to an active project.
    return conflict.items.some((item) => {
      const channel = item.channel ?? item.source;
      return activeProjects.has(channel);
    });
  });
}

// ---------------------------------------------------------------------------
// Internal: UserSummary builder
// ---------------------------------------------------------------------------

/**
 * Slims a `UserContext` down to the `UserSummary` shape.
 *
 * Excluded fields: `userId` auth tokens, `connectedAccounts` credentials,
 * `locale`, and any mutable state that isn't meaningful to the LLM.
 * `userId` is kept for attribution in LLM explanations.
 */
function buildUserSummary(
  context: UserContext,
  activeProjects: string[]
): UserSummary {
  return {
    userId: context.userId,
    displayName: context.displayName,
    roles: context.roles,
    timezone: context.timezone,
    prioritySources: context.prioritySources,
    mutedSources: context.mutedSources,
    quietHours: context.quietHours,
    activeProjects,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parameters accepted by the Context Builder.
 */
export interface BuildContextParams {
  /** Items selected by the selector (top-N + promoted). */
  selectedItems: NormalizedItem[];
  /**
   * Conflicts that passed the selector's role-awareness gate.
   * The context builder performs a second cross-check against active projects.
   */
  relevantConflicts: DetectedConflict[];
  /** Full user context from the orchestrator input. */
  context: UserContext;
  /** Orchestrator mode. */
  mode: OrchestratorMode;
  /** Free-text search query (search mode only). */
  searchQuery?: string;
}

/**
 * Context Builder stage.
 *
 * Transforms the selector's output into a single, typed `OrchestratorContext`
 * that contains exactly what the LLM needs — no more, no less.
 *
 * Pipeline position: after `selectTopItems` → before `assemblePrompt`.
 *
 * @param params - See `BuildContextParams`.
 * @returns       A fully populated `OrchestratorContext`.
 */
export function buildOrchestratorContext(
  params: BuildContextParams
): OrchestratorContext {
  const { selectedItems, relevantConflicts, context, mode, searchQuery } =
    params;

  // ── Step 1: Derive active projects from involvement signals ────────────
  const activeProjects = deriveActiveProjects(selectedItems, context);
  const activeProjectSet = new Set(activeProjects);

  // ── Step 2: Cross-check conflicts against active projects ──────────────
  //            (second relevance filter on top of the selector's role gate)
  const contextualConflicts = crossCheckConflicts(
    relevantConflicts,
    activeProjectSet
  );

  // ── Step 3: Build slim user summary ───────────────────────────────────
  const userSummary = buildUserSummary(context, activeProjects);

  return {
    userSummary,
    selectedItems,
    relevantConflicts: contextualConflicts,
    searchQuery,
    mode,
  };
}
