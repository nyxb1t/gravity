/**
 * @file ai/engine/index.ts
 * @description Public surface of the Gravity Intelligence Orchestrator.
 *
 * Import from this path only — `@/ai/engine`.
 * All internal modules (orchestrator.ts, selector.ts, context.ts, etc.)
 * are implementation details subject to change without notice.
 *
 * @example
 * ```ts
 * import { runOrchestrator } from "@/ai/engine";
 *
 * const output = await runOrchestrator({
 *   items: normalizedItems,
 *   context: userContext,
 *   mode: "lens",
 *   options: { topN: 8, debug: true },
 * });
 *
 * console.log(output.response.ok);          // true
 * console.log(output.rankedItems.length);   // ≤ 8
 * console.log(output.pipelineMeta);         // stage timings, versions, etc.
 * ```
 */

// ---------------------------------------------------------------------------
// Primary API
// ---------------------------------------------------------------------------

export { runOrchestrator } from "./orchestrator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  OrchestratorInput,
  OrchestratorOutput,
  OrchestratorContext,
  OrchestratorOptions,
  OrchestratorMode,
  LLMConfig,
  LLMProvider,
  PipelineMeta,
  UserSummary,
} from "./types";
