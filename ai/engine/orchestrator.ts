/**
 * @file ai/engine/orchestrator.ts
 * @description Gravity Intelligence Orchestrator — the pipeline coordinator.
 *
 * `runOrchestrator` is the single public function in this file. It wires
 * all components together in a deterministic, sequential pipeline:
 *
 * ```
 * NormalizedItem[] + UserContext
 *         │
 *         ▼
 *   Stage 1: [rankItems]            ai/ranking
 *         │
 *         ▼
 *   Stage 2: [detectConflicts]      ai/conflicts
 *         │
 *         ▼
 *   Stage 3: [selectTopItems]       selector.ts  ← role-aware conflict promotion
 *         │
 *         ▼
 *   Stage 4: [buildOrchestratorContext]  context.ts  ← NEW: Context Builder
 *         │                              derives active projects, cross-checks
 *         │                              conflicts, slims user context
 *         ▼
 *   Stage 5: [assemblePrompt]       assembler.ts
 *         │
 *         ▼
 *   Stage 6: [callLLM]              llm.ts
 *         │
 *         ▼
 *   Stage 7: [parseResponse]        parser.ts
 *         │
 *         ▼
 *   GravityResponse<RankedItem[]>
 * ```
 *
 * Error handling:
 *  - If the LLM call throws, `response.ok` is `false` and `response.error`
 *    carries the details. The deterministic ranking result is still returned
 *    in `response.data` as a graceful fallback.
 *  - If the parser fails, it falls back to the deterministic result silently.
 *  - No stage can crash the pipeline — every failure mode is handled.
 *
 * Observability:
 *  - Every stage is individually timed.
 *  - `pipelineMeta` on the output carries stage timings, item counts,
 *    engine versions, and the LLM provider used.
 *  - When `options.debug` is `true`, `meta` is also included in the
 *    `GravityResponse` envelope for API clients.
 */

import type { GravityResponse } from "@/types";
import type { RankedItem } from "@/ai/ranking";

import {
  type OrchestratorInput,
  type OrchestratorOutput,
  type PipelineMeta,
  type LLMConfig,
} from "./types";

import { rankItems } from "@/ai/ranking";
import { detectConflicts, CONFLICT_ENGINE_VERSION } from "@/ai/conflicts";
import { selectTopItems, filterRelevantConflicts } from "./selector";
import { buildOrchestratorContext } from "./context";
import { assemblePrompt } from "./assembler";
import { callLLM } from "./llm";
import {
  parseLensResponse,
  parseSearchResponse,
  parseConflictsResponse,
} from "./parser";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TOP_N = 10;

/**
 * Resolves the LLM config at call time so it picks up env vars correctly.
 * Uses Gemini when GEMINI_API_KEY is set, falls back to mock otherwise.
 */
function resolveLLMConfig(): LLMConfig {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    // Use gemini-1.5-flash by default (better free-tier limits than 2.0-flash)
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    return {
      provider: 'google',
      model,
      apiKey:   geminiKey,
    };
  }
  console.warn('[AI] ⚠️  GEMINI_API_KEY not set — using mock LLM provider');
  return { provider: 'mock', model: 'mock-v1' };
}

// ---------------------------------------------------------------------------
// Timing utility
// ---------------------------------------------------------------------------

/**
 * Creates a high-resolution stage timer using `performance.now()`.
 * Returns a function that, when called, yields the elapsed milliseconds
 * rounded to the nearest integer.
 */
function createTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full Gravity Intelligence Orchestration pipeline.
 *
 * @param input - Orchestrator input (items, user context, mode, options).
 * @returns       A fully populated `OrchestratorOutput`.
 */
export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const requestedAt = new Date().toISOString();
  const totalTimer = createTimer();

  const { items, context, mode, searchQuery, options = {} } = input;

  const {
    topN = DEFAULT_TOP_N,
    debug = false,
    nowMs = Date.now(),
    llm: llmConfig = resolveLLMConfig(),
  } = options;

  // Stage timing accumulator — populated inline as each stage completes.
  const stageTimings: PipelineMeta["stageTimings"] = {
    ranking: 0,
    conflicts: 0,
    selection: 0,
    contextBuild: 0,
    promptAssembly: 0,
    llmCall: 0,
    parsing: 0,
  };

  // ── Stage 1: Ranking ─────────────────────────────────────────────────────
  const rankingTimer = createTimer();
  const ranked = rankItems(items, context, nowMs);
  stageTimings.ranking = rankingTimer();

  // ── Stage 2: Conflict Detection ──────────────────────────────────────────
  const conflictsTimer = createTimer();
  const conflictResult = detectConflicts(items, context, nowMs);
  stageTimings.conflicts = conflictsTimer();

  // Pre-build the ranked item map used by both the selector and the
  // Context Builder's conflict cross-check.
  const rankedItemMap = new Map<string, RankedItem>(
    ranked.map((r) => [r.item.raw.id, r])
  );

  // ── Stage 3: Selection (role-aware conflict promotion) ───────────────────
  const selectionTimer = createTimer();
  const { selectedItems, promotedCount } = selectTopItems(
    ranked,
    conflictResult.conflicts,
    context,
    topN
  );

  // Compute the role-relevant conflicts (all severity bands) for the Context
  // Builder. The selector already filtered critical/high for promotion; here
  // we include all severity bands that are role-relevant so the Context
  // Builder has the full picture for its cross-check.
  const relevantConflicts = filterRelevantConflicts(
    conflictResult.conflicts,
    context,
    rankedItemMap
  );
  stageTimings.selection = selectionTimer();

  // ── Stage 4: Context Builder ─────────────────────────────────────────────
  const contextTimer = createTimer();
  const orchestratorContext = buildOrchestratorContext({
    selectedItems,
    relevantConflicts,
    context,
    mode,
    searchQuery,
  });
  stageTimings.contextBuild = contextTimer();

  // ── Stage 5: Prompt Assembly ─────────────────────────────────────────────
  const assemblyTimer = createTimer();
  const prompt = assemblePrompt(orchestratorContext);
  stageTimings.promptAssembly = assemblyTimer();

  // ── Stage 6: LLM Call ────────────────────────────────────────────────────
  const llmTimer = createTimer();
  let llmRaw = "";
  let llmError:
    | { code: string; message: string; details?: Record<string, unknown> }
    | undefined;

  console.log(`[AI] 🤖 Using provider: ${llmConfig.provider} (${llmConfig.model})`);

  try {
    llmRaw = await callLLM(prompt, llmConfig);
    console.log(`[AI] ✅ LLM call succeeded in ${llmTimer()}ms`);
  } catch (err) {
    console.error(`[AI] ❌ LLM call failed (${llmConfig.provider}):`, err instanceof Error ? err.message : err);
    llmError = {
      code: "LLM_CALL_FAILED",
      message:
        err instanceof Error ? err.message : "Unknown error during LLM call",
      ...(debug
        ? {
            details: {
              provider: llmConfig.provider,
              model: llmConfig.model,
            },
          }
        : {}),
    };
  }
  stageTimings.llmCall = llmTimer();

  // ── Stage 7: Parsing ─────────────────────────────────────────────────────
  const parsingTimer = createTimer();
  let finalItems: RankedItem[];

  if (llmError) {
    // Graceful fallback: return the deterministic ranking result.
    finalItems = ranked;
  } else {
    switch (mode) {
      case "lens":
        finalItems = parseLensResponse(llmRaw, ranked);
        break;
      case "search":
        finalItems = parseSearchResponse(llmRaw, ranked);
        break;
      case "conflicts":
        // Conflicts mode: LLM response is advisory — deterministic engine wins.
        parseConflictsResponse(llmRaw, conflictResult.conflicts);
        finalItems = ranked;
        break;
      default: {
        const _never: never = mode;
        throw new Error(`Unhandled orchestrator mode: ${_never}`);
      }
    }
  }
  stageTimings.parsing = parsingTimer();

  // ── Assemble pipeline metadata ───────────────────────────────────────────
  const totalDuration = totalTimer();
  const modelVersion = ranked[0]?.score.modelVersion ?? "unknown";

  const pipelineMeta: PipelineMeta = {
    durationMs: totalDuration,
    stageTimings,
    itemsInput: items.length,
    itemsAfterSelection: selectedItems.length,
    conflictsDetected: conflictResult.total,
    conflictsPromoted: promotedCount,
    modelVersion,
    conflictEngineVersion: CONFLICT_ENGINE_VERSION,
    llmProvider: llmConfig.provider,
    requestedAt,
  };

  // ── Assemble GravityResponse ─────────────────────────────────────────────
  const gravityResponse: GravityResponse<RankedItem[]> = {
    ok: !llmError,
    data: finalItems,
    ...(llmError ? { error: llmError } : {}),
    totalCount: finalItems.length,
    conflicts: orchestratorContext.relevantConflicts,
    ...(debug
      ? {
          meta: {
            durationMs: totalDuration,
            itemsEvaluated: items.length,
            itemsReturned: finalItems.length,
            modelVersion,
            requestedAt,
          },
        }
      : {}),
  };

  return {
    response: gravityResponse,
    rankedItems: finalItems,
    conflictResult,
    pipelineMeta,
  };
}
