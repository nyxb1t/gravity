/**
 * @file ai/conflicts/index.ts
 * @description Public surface of the Gravity Conflict Detection Engine.
 *
 * Import from this file only. Internal modules (engine.ts, utils.ts, rules/*)
 * are implementation details and subject to change without notice.
 *
 * @example
 * ```ts
 * import { detectConflicts } from "@/ai/conflicts";
 *
 * const result = detectConflicts(normalizedItems, userContext);
 * console.log(result.summary);    // { critical: 2, high: 1, medium: 0, low: 0 }
 * console.log(result.conflicts);  // DetectedConflict[]
 * ```
 */

// ---------------------------------------------------------------------------
// Primary API
// ---------------------------------------------------------------------------

export { runConflictEngine as detectConflicts } from "./engine";
export { runConflictEngineRaw as detectConflictsRaw } from "./engine";
export { CONFLICT_ENGINE_VERSION } from "./engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  DetectedConflict,
  ConflictDetectionResult,
  ConflictKind,
  SuggestedAction,
  RuleContext,
  ConflictRule,
} from "./types";

export { SEVERITY_SCORE } from "./types";
