/**
 * @file ai/engine/assembler.ts
 * @description Prompt Assembler — Stage 5 of the Gravity Orchestration Pipeline.
 *
 * Combines the appropriate system prompt template with the serialised
 * `OrchestratorContext` payload to produce the final string sent to the LLM.
 *
 * Design principles:
 *  - The assembler is a pure serialisation concern. No logic about what
 *    to include lives here — that is the Context Builder's job.
 *  - Items are "slimmed" before serialisation: bodies are truncated at
 *    MAX_BODY_LENGTH, and `metadata` is stripped to keep prompts compact.
 *  - The DATA block uses a deterministic `JSON.stringify` with 2-space
 *    indent so diffs are human-readable in logs.
 *  - Each mode injects slightly different keys into the data payload
 *    (e.g. `searchQuery` for search mode, `detectedConflicts` when present).
 *
 * No LLM. No I/O. Pure deterministic TypeScript.
 */

import { GRAVITY_LENS_PROMPT } from "@/ai/prompts/lens";
import { GRAVITY_SEARCH_PROMPT } from "@/ai/prompts/search";
import { CONFLICT_DETECTION_PROMPT } from "@/ai/prompts/conflicts";
import type { NormalizedItem } from "@/types";
import type { DetectedConflict } from "@/ai/conflicts";
import type { OrchestratorContext } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Body text beyond this length is truncated with an ellipsis. */
const MAX_BODY_LENGTH = 500;

// ---------------------------------------------------------------------------
// Internal: item serialisation
// ---------------------------------------------------------------------------

/**
 * Produces a slim, serialisable representation of a `NormalizedItem` for
 * inclusion in the prompt payload.
 *
 * Strips:
 *  - `metadata` (provider-native fields the LLM doesn't need)
 *  - Avatar URLs (waste tokens)
 *  - `isRead`, `isBookmarked`, `userNote`, `lastProcessedAt` (pipeline state)
 *
 * Truncates:
 *  - `body` beyond MAX_BODY_LENGTH characters
 */
function slimItem(item: NormalizedItem): Record<string, unknown> {
  const raw = item.raw;
  return {
    id: raw.id,
    source: raw.source,
    kind: raw.kind,
    title: raw.title,
    body:
      raw.body.length > MAX_BODY_LENGTH
        ? `${raw.body.slice(0, MAX_BODY_LENGTH)}…`
        : raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    url: raw.url,
    author: raw.author
      ? { id: raw.author.id, displayName: raw.author.displayName }
      : null,
    participants: raw.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      role: p.role,
    })),
    mentionsUser: raw.mentionsUser,
    channel: raw.channel,
    tags: raw.tags,
  };
}

/**
 * Produces a slim representation of a `DetectedConflict` for the prompt.
 * Only includes fields useful for LLM reasoning — strips internal engine
 * fields like `severityScore` and the full `items` array.
 */
function slimConflict(conflict: DetectedConflict): Record<string, unknown> {
  return {
    id: conflict.id,
    kind: conflict.kind,
    type: conflict.type,
    description: conflict.description,
    severity: conflict.severity,
    relatedItemIds: conflict.relatedItemIds,
    suggestedActions: conflict.suggestedActions.map((a) => ({
      label: a.label,
      rationale: a.rationale,
      targetItemId: a.targetItemId,
    })),
  };
}

// ---------------------------------------------------------------------------
// Internal: system prompt selection
// ---------------------------------------------------------------------------

function selectSystemPrompt(mode: OrchestratorContext["mode"]): string {
  switch (mode) {
    case "lens":
      return GRAVITY_LENS_PROMPT;
    case "search":
      return GRAVITY_SEARCH_PROMPT;
    case "conflicts":
      return CONFLICT_DETECTION_PROMPT;
    default: {
      const _never: never = mode;
      throw new Error(`Unknown orchestrator mode: ${_never}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assembles the final LLM prompt from an `OrchestratorContext`.
 *
 * Structure of the output string:
 * ```
 * <system prompt template>
 *
 * ---
 *
 * DATA:
 * {
 *   "userContext": { ... },
 *   "items": [ ... ],
 *   "detectedConflicts": [ ... ],  // present when relevantConflicts is non-empty
 *   "searchQuery": "..."            // present in search mode only
 * }
 * ```
 *
 * @param ctx - The `OrchestratorContext` produced by the Context Builder.
 * @returns     The full prompt string ready to be sent to the LLM.
 */
export function assemblePrompt(ctx: OrchestratorContext): string {
  const systemPrompt = selectSystemPrompt(ctx.mode);

  // Build the data payload incrementally, adding only what is relevant.
  const dataPayload: Record<string, unknown> = {
    userContext: ctx.userSummary,
    items: ctx.selectedItems.map(slimItem),
  };

  // Conflicts are only included when the context builder found relevant ones.
  if (ctx.relevantConflicts.length > 0) {
    dataPayload.detectedConflicts = ctx.relevantConflicts.map(slimConflict);
  }

  // Search query is only meaningful in search mode.
  if (ctx.mode === "search" && ctx.searchQuery) {
    dataPayload.searchQuery = ctx.searchQuery;
  }

  return [
    systemPrompt,
    "",
    "---",
    "",
    "DATA:",
    JSON.stringify(dataPayload, null, 2),
  ].join("\n");
}
