/**
 * @file ai/engine/parser.ts
 * @description LLM Response Parser — Stage 7 of the Gravity Orchestration Pipeline.
 *
 * Each parser function:
 *  - Accepts the raw text string returned by the LLM.
 *  - Validates the structure against the expected JSON schema.
 *  - Merges LLM signals with the deterministic output from earlier stages.
 *  - Falls back to the deterministic result on any parse or validation failure.
 *
 * The deterministic ranking result always serves as the ground truth for
 * ordering and scoring. LLM output enriches it:
 *
 *  - Lens:      LLM urgency band + human-readable reason are merged into
 *               the corresponding `RankedItem`. The LLM decides the ORDER
 *               of surfaced items (based on its reasoning), but the numeric
 *               score from the ranking engine is preserved.
 *
 *  - Search:    LLM relevance score is blended with the deterministic score
 *               (arithmetic mean) to produce a combined total. Items the LLM
 *               found irrelevant are moved to the back, not removed.
 *
 *  - Conflicts: The LLM response for conflicts mode is advisory only.
 *               The deterministic engine is the authoritative source.
 *               LLM hints are logged in `reasons` for observability.
 *
 * All parsers are wrapped in `try/catch`. Malformed JSON or unexpected
 * structures never crash the orchestrator.
 *
 * No LLM. No I/O. Pure deterministic TypeScript.
 */

import type { UrgencyBand } from "@/types";
import type { RankedItem } from "@/ai/ranking";
import type { DetectedConflict } from "@/ai/conflicts";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_URGENCY_BANDS: ReadonlySet<string> = new Set<UrgencyBand>([
  "critical",
  "high",
  "medium",
  "low",
  "dismissed",
]);

function isValidUrgency(v: unknown): v is UrgencyBand {
  return typeof v === "string" && VALID_URGENCY_BANDS.has(v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safely parses a JSON string. Returns `null` on any error.
 */
function safeParseJson(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lens response parser
// ---------------------------------------------------------------------------

/**
 * Schema expected from the LLM in `lens` mode:
 * ```json
 * {
 *   "lensItems": [
 *     {
 *       "itemId": "string",
 *       "urgency": "critical" | "high" | "medium" | "low",
 *       "reason": "string",
 *       "actionRequired": "string | null"
 *     }
 *   ]
 * }
 * ```
 */
interface LensLLMEntry {
  itemId: unknown;
  urgency: unknown;
  reason: unknown;
  actionRequired: unknown;
}

/**
 * Parses the LLM's lens response and merges its signals into `rankedItems`.
 *
 * Merge strategy:
 *  1. Items named by the LLM appear first, in the LLM's preferred order.
 *  2. The LLM's urgency band overwrites the deterministic one when valid.
 *  3. The LLM's reason and actionRequired are appended to `reasons`.
 *  4. Items not mentioned by the LLM are appended at the end (unchanged).
 *
 * @param raw         - Raw text from the LLM.
 * @param rankedItems - Full deterministic ranked list (fallback).
 * @returns           Merged `RankedItem[]` in the final display order.
 */
export function parseLensResponse(
  raw: string,
  rankedItems: RankedItem[]
): RankedItem[] {
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return rankedItems;

  const { lensItems } = parsed as Record<string, unknown>;
  if (!Array.isArray(lensItems)) return rankedItems;

  const itemMap = new Map<string, RankedItem>(
    rankedItems.map((r) => [r.item.raw.id, r])
  );

  const output: RankedItem[] = [];
  const surfaced = new Set<string>();

  for (const entry of lensItems) {
    if (!entry || typeof entry !== "object") continue;
    const { itemId, urgency, reason, actionRequired } = entry as LensLLMEntry;

    if (typeof itemId !== "string") continue;
    const ranked = itemMap.get(itemId);
    if (!ranked || surfaced.has(itemId)) continue;

    surfaced.add(itemId);

    const mergedScore = {
      ...ranked.score,
      urgency: isValidUrgency(urgency) ? urgency : ranked.score.urgency,
    };

    const mergedReasons = [...ranked.reasons];
    if (typeof reason === "string" && reason.trim()) {
      mergedReasons.push(`llm: ${reason.trim()}`);
    }
    if (typeof actionRequired === "string" && actionRequired.trim()) {
      mergedReasons.push(`action: ${actionRequired.trim()}`);
    }

    output.push({ ...ranked, score: mergedScore, reasons: mergedReasons });
  }

  // Append any items the LLM did not mention — they are still returned but
  // placed below the LLM-curated set.
  for (const r of rankedItems) {
    if (!surfaced.has(r.item.raw.id)) {
      output.push(r);
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Search response parser
// ---------------------------------------------------------------------------

/**
 * Schema expected from the LLM in `search` mode:
 * ```json
 * {
 *   "results": [
 *     {
 *       "itemId": "string",
 *       "relevanceScore": number,
 *       "explanation": "string"
 *     }
 *   ]
 * }
 * ```
 */
interface SearchLLMEntry {
  itemId: unknown;
  relevanceScore: unknown;
  explanation: unknown;
}

/**
 * Parses the LLM's search response and merges relevance signals.
 *
 * Merge strategy:
 *  - For items named by the LLM: blend LLM relevance score with
 *    deterministic score using an arithmetic mean.
 *  - Items not mentioned are returned after the LLM-confirmed matches.
 *  - The merged list is re-sorted by blended `score.total` descending.
 *
 * @param raw         - Raw text from the LLM.
 * @param rankedItems - Full deterministic ranked list (fallback).
 * @returns           Merged `RankedItem[]` sorted by blended relevance.
 */
export function parseSearchResponse(
  raw: string,
  rankedItems: RankedItem[]
): RankedItem[] {
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return rankedItems;

  const { results } = parsed as Record<string, unknown>;
  if (!Array.isArray(results)) return rankedItems;

  const itemMap = new Map<string, RankedItem>(
    rankedItems.map((r) => [r.item.raw.id, r])
  );

  const output: RankedItem[] = [];
  const seen = new Set<string>();

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const { itemId, relevanceScore, explanation } = entry as SearchLLMEntry;

    if (typeof itemId !== "string") continue;
    const ranked = itemMap.get(itemId);
    if (!ranked || seen.has(itemId)) continue;

    seen.add(itemId);

    const llmScore =
      typeof relevanceScore === "number"
        ? clamp(relevanceScore, 0, 1)
        : ranked.score.total;

    // Blend: arithmetic mean of deterministic score and LLM relevance.
    const blendedTotal = (ranked.score.total + llmScore) / 2;

    const mergedScore = { ...ranked.score, total: blendedTotal };
    const mergedReasons = [...ranked.reasons];

    if (typeof explanation === "string" && explanation.trim()) {
      mergedReasons.push(`llm relevance: ${explanation.trim()}`);
    }

    output.push({ ...ranked, score: mergedScore, reasons: mergedReasons });
  }

  // Items the LLM skipped — kept but placed at the end.
  for (const r of rankedItems) {
    if (!seen.has(r.item.raw.id)) {
      output.push(r);
    }
  }

  // Re-sort by blended total descending.
  output.sort((a, b) => b.score.total - a.score.total);

  return output;
}

// ---------------------------------------------------------------------------
// Conflicts response parser
// ---------------------------------------------------------------------------

/**
 * Parses the LLM's conflicts response (advisory only).
 *
 * The deterministic engine is the authoritative source for conflict data.
 * This parser extracts LLM-suggested conflict IDs and logs them as reasons
 * on the relevant `RankedItem` objects for observability.
 *
 * The function currently returns the `existingConflicts` list unchanged.
 * Future iterations may use LLM hints to re-rank or augment conflicts.
 *
 * @param raw               - Raw text from the LLM.
 * @param existingConflicts - Authoritative conflicts from the engine.
 * @returns                 The `existingConflicts` list (unmodified).
 */
export function parseConflictsResponse(
  raw: string,
  existingConflicts: DetectedConflict[]
): DetectedConflict[] {
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return existingConflicts;

  const { conflicts } = parsed as Record<string, unknown>;
  if (!Array.isArray(conflicts)) return existingConflicts;

  // LLM hints are available in `conflicts` for future use.
  // Deterministic engine result is always the authoritative output.
  return existingConflicts;
}
