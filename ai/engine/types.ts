/**
 * @file ai/engine/types.ts
 * @description Input / output contracts for the Gravity Intelligence Orchestrator.
 *
 * All types that are specific to the orchestration pipeline live here.
 * They are intentionally kept separate from `types/index.ts` to avoid
 * coupling the core data model to pipeline internals.
 *
 * No business logic lives here. Only data contracts.
 */

import type { NormalizedItem, UserContext, GravityResponse } from "@/types";
import type { RankedItem } from "@/ai/ranking";
import type { ConflictDetectionResult, DetectedConflict } from "@/ai/conflicts";

// ---------------------------------------------------------------------------
// LLM Configuration
// ---------------------------------------------------------------------------

/**
 * All supported LLM providers.
 *
 * `"mock"` is the default: it returns a realistic canned response with zero
 * network calls, making the orchestrator fully functional offline and in CI.
 */
export type LLMProvider = "openai" | "anthropic" | "google" | "mock";

/**
 * Provider-agnostic LLM configuration.
 * Passed through to `llm.ts` — the only layer that touches external APIs.
 */
export interface LLMConfig {
  /** Which provider to route the prompt to. Defaults to `"mock"`. */
  provider: LLMProvider;

  /**
   * Provider-specific model identifier.
   * e.g. "gpt-4o", "claude-3-5-sonnet-20241022", "gemini-2.0-flash"
   */
  model: string;

  /**
   * API key for the chosen provider.
   * Not required for `"mock"`. Should come from environment variables —
   * never hard-coded.
   */
  apiKey?: string;

  /**
   * Sampling temperature in [0, 1].
   * Lower values produce more deterministic output. Default: 0.2.
   */
  temperature?: number;

  /**
   * Maximum number of tokens the LLM may generate.
   * Default: 2048.
   */
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Orchestrator mode
// ---------------------------------------------------------------------------

/**
 * Determines which prompt template and response parser the orchestrator uses.
 *
 * - `lens`      → surface the most critical items (GRAVITY_LENS_PROMPT)
 * - `search`    → semantic search against a query (GRAVITY_SEARCH_PROMPT)
 * - `conflicts` → detect and explain conflicts (CONFLICT_DETECTION_PROMPT)
 */
export type OrchestratorMode = "lens" | "search" | "conflicts";

// ---------------------------------------------------------------------------
// Orchestrator options
// ---------------------------------------------------------------------------

/**
 * Optional knobs that tune the orchestration pipeline.
 * All fields have safe defaults so callers never need to supply this.
 */
export interface OrchestratorOptions {
  /**
   * Maximum number of items to send to the LLM after ranking and selection.
   * Higher values give the LLM more context at the cost of longer prompts.
   * Default: 10.
   */
  topN?: number;

  /**
   * When `true`, the response includes `GravityResponse.meta` with
   * per-stage timing and version metadata.
   * Default: false (omit in production to avoid leaking internals).
   */
  debug?: boolean;

  /**
   * Pin the "now" timestamp (Unix epoch ms) for deterministic testing.
   * When omitted, `Date.now()` is used.
   */
  nowMs?: number;

  /** LLM configuration. Defaults to the `"mock"` provider. */
  llm?: LLMConfig;
}

// ---------------------------------------------------------------------------
// Orchestrator input
// ---------------------------------------------------------------------------

/**
 * The single intake shape for the `runOrchestrator` function.
 *
 * All pipeline stages receive what they need from this object —
 * no stage reaches outside to fetch additional data.
 */
export interface OrchestratorInput {
  /** Pre-normalised workspace items from any integration adapter. */
  items: NormalizedItem[];

  /** Full context for the requesting user. */
  context: UserContext;

  /** Which intelligence mode to run. */
  mode: OrchestratorMode;

  /**
   * Free-text search query.
   * Required when `mode === "search"`, ignored otherwise.
   */
  searchQuery?: string;

  /** Optional pipeline configuration. Defaults are safe for all fields. */
  options?: OrchestratorOptions;
}

// ---------------------------------------------------------------------------
// Orchestrator context  (output of the Context Builder stage)
// ---------------------------------------------------------------------------

/**
 * Slim user summary passed to the LLM.
 *
 * Intentionally a subset of `UserContext` — the LLM doesn't need raw
 * integration credentials, locale strings, or mutable state.
 */
export interface UserSummary {
  userId: string;
  displayName: string;
  /** Roles the user holds (e.g. "engineering", "team-lead"). */
  roles: string[];
  /** IANA timezone string (e.g. "Asia/Kolkata"). */
  timezone: string;
  /** Sources the user has pinned as high-priority. */
  prioritySources: string[];
  /** Sources the user has muted. */
  mutedSources: string[];
  /** Quiet hours window (if configured). */
  quietHours?: { start: string; end: string };
  /**
   * Channels / repos the user is actively involved in, derived by the
   * Context Builder from the selected items.
   * Tells the LLM which work streams matter most right now.
   */
  activeProjects: string[];
}

/**
 * The assembled context handed from the Context Builder stage to the
 * Prompt Assembler. This is the single, typed representation of everything
 * the LLM needs — nothing more, nothing less.
 */
export interface OrchestratorContext {
  /** Slim, LLM-safe user summary. */
  userSummary: UserSummary;

  /**
   * Highest-priority items after ranking + role-aware conflict promotion.
   * These are the items the LLM is asked to reason over.
   */
  selectedItems: NormalizedItem[];

  /**
   * Conflicts that are relevant to this user's roles and active work.
   * Filtered by the selector; not every detected conflict is included.
   */
  relevantConflicts: DetectedConflict[];

  /** The free-text search query (search mode only). */
  searchQuery?: string;

  /** The current orchestrator mode. */
  mode: OrchestratorMode;
}

// ---------------------------------------------------------------------------
// Pipeline metadata
// ---------------------------------------------------------------------------

/**
 * Per-stage timing breakdown and pipeline provenance information.
 *
 * Included in `OrchestratorOutput.pipelineMeta` and optionally surfaced
 * in `GravityResponse.meta` when `options.debug` is true.
 */
export interface PipelineMeta {
  /** Total wall-clock duration of the full orchestration run in ms. */
  durationMs: number;

  /** Milliseconds spent in each named stage. */
  stageTimings: {
    ranking: number;
    conflicts: number;
    selection: number;
    contextBuild: number;
    promptAssembly: number;
    llmCall: number;
    parsing: number;
  };

  /** Number of `NormalizedItem` objects received as input. */
  itemsInput: number;

  /** Number of items after top-N selection + conflict promotion. */
  itemsAfterSelection: number;

  /** Total conflicts detected by the deterministic engine. */
  conflictsDetected: number;

  /**
   * Number of items promoted into the selection set because they were
   * involved in a critical/high conflict relevant to the user's role.
   */
  conflictsPromoted: number;

  /** Semver version of the ranking model used. */
  modelVersion: string;

  /** Semver version of the conflict detection engine used. */
  conflictEngineVersion: string;

  /** Which LLM provider handled the prompt. */
  llmProvider: LLMProvider;

  /** ISO 8601 UTC timestamp when the orchestration run started. */
  requestedAt: string;
}

// ---------------------------------------------------------------------------
// Orchestrator output
// ---------------------------------------------------------------------------

/**
 * Full output returned by `runOrchestrator`.
 *
 * The `response` field is the `GravityResponse` envelope that the API
 * layer surfaces to clients. The remaining fields are pipeline internals
 * useful for logging, debugging, and downstream processing.
 */
export interface OrchestratorOutput {
  /**
   * The canonical API response.
   * `ok` is `false` only when the LLM call failed; the deterministic
   * ranking result is still present in `data` as a graceful fallback.
   */
  response: GravityResponse<RankedItem[]>;

  /**
   * Final ranked items — identical to `response.data` but typed directly
   * so callers don't have to cast through the `GravityResponse<T>` generic.
   */
  rankedItems: RankedItem[];

  /** Raw output from the conflict detection engine. */
  conflictResult: ConflictDetectionResult;

  /** Full pipeline provenance for logging and observability. */
  pipelineMeta: PipelineMeta;
}
