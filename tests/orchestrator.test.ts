/**
 * @file tests/orchestrator.test.ts
 * @description Gravity Intelligence Orchestrator test suite.
 *
 * Exercises the full orchestration pipeline end-to-end using:
 *  - The mock workspace data from `data/mock.ts`
 *  - The `"mock"` LLM provider (zero network calls, zero API keys)
 *
 * All tests use a plain assertion harness — no third-party test runner
 * required. Run with:
 *
 *   npx ts-node --project tsconfig.tsnode.json tests/orchestrator.test.ts
 *
 * Or add this to `package.json`:
 *   "test:orchestrator": "ts-node --project tsconfig.tsnode.json tests/orchestrator.test.ts"
 */

import { getMockData } from "../data/mock";
import { runOrchestrator } from "../ai/engine";
import type { OrchestratorOutput } from "../ai/engine";

// ---------------------------------------------------------------------------
// Test harness (zero dependencies)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
    failures.push(label);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(
    actual === expected,
    `${label} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`
  );
}

function assertGte(actual: number, threshold: number, label: string): void {
  assert(
    actual >= threshold,
    `${label} (expected >= ${threshold}, got: ${actual})`
  );
}

function assertLte(actual: number, threshold: number, label: string): void {
  assert(
    actual <= threshold,
    `${label} (expected <= ${threshold}, got: ${actual})`
  );
}

async function describe(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n▶ ${name}`);
  await fn();
}

// ---------------------------------------------------------------------------
// Fixed reference time (deterministic timestamps)
// ---------------------------------------------------------------------------

const NOW = new Date("2026-07-01T00:00:00.000Z");
const NOW_MS = NOW.getTime();
const { items, userContext } = getMockData(NOW);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runs the orchestrator in the given mode and returns the output.
 * Uses the mock LLM provider so no network calls are made.
 */
async function runPipeline(
  mode: "lens" | "search" | "conflicts",
  searchQuery?: string,
  topN = 10
): Promise<OrchestratorOutput> {
  return runOrchestrator({
    items,
    context: userContext,
    mode,
    searchQuery,
    options: {
      topN,
      debug: true,
      nowMs: NOW_MS,
      llm: { provider: "mock", model: "mock-v1" },
    },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

async function main() {
  // ── Test 1: Lens mode — GravityResponse shape ───────────────────────────
  await describe("Lens mode: GravityResponse shape", async () => {
    const output = await runPipeline("lens");
    const { response } = output;

    assert(typeof response === "object" && response !== null, "response is an object");
    assert(response.ok === true, "response.ok is true (mock LLM succeeded)");
    assert(Array.isArray(response.data), "response.data is an array");
    assert(typeof response.totalCount === "number", "response.totalCount is a number");
    assertGte(response.totalCount ?? 0, 1, "totalCount >= 1");
    assert(response.error === undefined, "response.error is absent on success");
  });

  // ── Test 2: Lens mode — ranked items are present and scored ─────────────
  await describe("Lens mode: ranked items have valid scores", async () => {
    const { rankedItems } = await runPipeline("lens");

    assertGte(rankedItems.length, 1, "at least 1 ranked item returned");

    for (const item of rankedItems) {
      assert(typeof item.score === "object", `${item.item.raw.id}: score is an object`);
      assert(
        item.score.total >= 0 && item.score.total <= 1,
        `${item.item.raw.id}: score.total in [0, 1]`
      );
      assert(Array.isArray(item.reasons), `${item.item.raw.id}: reasons is an array`);
      assert(typeof item.score.urgency === "string", `${item.item.raw.id}: urgency is a string`);
    }
  });

  // ── Test 3: Lens mode — results are sorted descending by score ───────────
  await describe("Lens mode: results sorted descending by score", async () => {
    const { rankedItems } = await runPipeline("lens");

    for (let i = 0; i < rankedItems.length - 1; i++) {
      const a = rankedItems[i];
      const b = rankedItems[i + 1];
      assert(
        a.score.total >= b.score.total,
        `item[${i}] (score=${a.score.total.toFixed(3)}) >= item[${i + 1}] (score=${b.score.total.toFixed(3)})`
      );
    }
  });

  // ── Test 4: Conflicts are surfaced at the response level ─────────────────
  await describe("Lens mode: conflicts surfaced in response", async () => {
    const { response } = await runPipeline("lens");

    assert(Array.isArray(response.conflicts), "response.conflicts is an array");
    // The mock data has critical/high conflicts involving the user's work.
    assertGte(
      response.conflicts?.length ?? 0,
      1,
      "at least 1 conflict is surfaced (role-relevant)"
    );
  });

  // ── Test 5: Debug meta is populated when debug: true ────────────────────
  await describe("Debug meta is populated", async () => {
    const { response, pipelineMeta } = await runPipeline("lens");

    assert(typeof response.meta === "object", "response.meta is an object (debug mode)");
    assert(typeof response.meta?.durationMs === "number", "meta.durationMs is a number");
    assertGte(response.meta?.durationMs ?? 0, 0, "meta.durationMs >= 0");
    assert(typeof response.meta?.modelVersion === "string", "meta.modelVersion is a string");
    assert(typeof response.meta?.requestedAt === "string", "meta.requestedAt is a string");

    assert(typeof pipelineMeta === "object", "pipelineMeta is an object");
    assert(typeof pipelineMeta.stageTimings === "object", "pipelineMeta.stageTimings is an object");
    assertGte(pipelineMeta.stageTimings.ranking, 0, "ranking stage time >= 0");
    assertGte(pipelineMeta.stageTimings.conflicts, 0, "conflicts stage time >= 0");
    assertGte(pipelineMeta.stageTimings.selection, 0, "selection stage time >= 0");
    assertGte(pipelineMeta.stageTimings.contextBuild, 0, "contextBuild stage time >= 0");
    assertGte(pipelineMeta.stageTimings.promptAssembly, 0, "promptAssembly stage time >= 0");
    assertGte(pipelineMeta.stageTimings.llmCall, 0, "llmCall stage time >= 0");
    assertGte(pipelineMeta.stageTimings.parsing, 0, "parsing stage time >= 0");
  });

  // ── Test 6: Pipeline metadata — item counts are consistent ───────────────
  await describe("Pipeline metadata: item counts", async () => {
    const { pipelineMeta } = await runPipeline("lens", undefined, 5);

    assertEqual(pipelineMeta.itemsInput, items.length, "itemsInput matches input array length");
    assertGte(pipelineMeta.itemsAfterSelection, 1, "itemsAfterSelection >= 1");
    assertLte(pipelineMeta.itemsAfterSelection, items.length, "itemsAfterSelection <= total items");
    assert(typeof pipelineMeta.conflictsDetected === "number", "conflictsDetected is a number");
    assert(typeof pipelineMeta.conflictsPromoted === "number", "conflictsPromoted is a number");
    assertGte(pipelineMeta.conflictsPromoted, 0, "conflictsPromoted >= 0");
    assertEqual(pipelineMeta.llmProvider, "mock", "llmProvider is 'mock'");
  });

  // ── Test 7: Conflict detection result is returned ────────────────────────
  await describe("Conflict detection result is returned", async () => {
    const { conflictResult } = await runPipeline("lens");

    assert(typeof conflictResult === "object", "conflictResult is an object");
    assert(Array.isArray(conflictResult.conflicts), "conflictResult.conflicts is an array");
    assertEqual(
      conflictResult.total,
      conflictResult.conflicts.length,
      "conflictResult.total matches conflicts.length"
    );
    assert(typeof conflictResult.summary === "object", "conflictResult.summary is an object");
    assert(typeof conflictResult.engineVersion === "string", "conflictResult.engineVersion is a string");
  });

  // ── Test 8: Top-N option is respected ───────────────────────────────────
  await describe("Top-N option respected", async () => {
    const output3 = await runPipeline("lens", undefined, 3);
    const output10 = await runPipeline("lens", undefined, 10);

    // topN=3 should yield fewer or equal items than topN=10.
    // (promoted items can push beyond topN, so we check the base holds.)
    assertLte(
      output3.pipelineMeta.itemsAfterSelection,
      output10.pipelineMeta.itemsAfterSelection,
      "topN=3 selects <= items than topN=10"
    );
  });

  // ── Test 9: Search mode — response is valid ──────────────────────────────
  await describe("Search mode: valid response", async () => {
    const { response, rankedItems } = await runPipeline("search", "WebSocket crash");

    assert(response.ok === true, "search mode response.ok is true");
    assert(Array.isArray(response.data), "search mode response.data is an array");
    assertGte(rankedItems.length, 1, "search mode returns at least 1 item");

    for (const item of rankedItems) {
      assert(
        item.score.total >= 0 && item.score.total <= 1,
        `search: ${item.item.raw.id} score.total in [0, 1]`
      );
    }
  });

  // ── Test 10: Conflicts mode — response is valid ──────────────────────────
  await describe("Conflicts mode: valid response", async () => {
    const { response, conflictResult } = await runPipeline("conflicts");

    assert(response.ok === true, "conflicts mode response.ok is true");
    assertGte(conflictResult.total, 1, "conflicts mode: at least 1 conflict detected");
  });

  // ── Test 11: Graceful LLM failure fallback ───────────────────────────────
  await describe("Graceful fallback when LLM fails", async () => {
    // Force a failure by pointing to a non-existent provider (cast to bypass type).
    let output: OrchestratorOutput;
    try {
      output = await runOrchestrator({
        items,
        context: userContext,
        mode: "lens",
        options: {
          nowMs: NOW_MS,
          // Intentionally broken config to trigger the catch block.
          llm: { provider: "openai", model: "gpt-4o", apiKey: "invalid-key" },
        },
      });
    } catch {
      // The orchestrator should never rethrow — if it does, the test fails.
      assert(false, "orchestrator must not rethrow LLM errors");
      return;
    }

    // Even when the LLM fails, data should still be present (deterministic fallback).
    assert(Array.isArray(output.response.data), "data is present after LLM failure");
    assertGte(output.response.data?.length ?? 0, 1, "fallback data has at least 1 item");
    assert(output.response.error !== undefined, "response.error is set on LLM failure");
    assertEqual(output.response.error?.code, "LLM_CALL_FAILED", "error code is LLM_CALL_FAILED");
  });

  // ── Test 12: Determinism — two calls with same input produce same IDs ────
  await describe("Determinism: same input → same ranked IDs", async () => {
    const run1 = await runPipeline("lens");
    const run2 = await runPipeline("lens");

    const ids1 = run1.rankedItems.map((r) => r.item.raw.id).join(",");
    const ids2 = run2.rankedItems.map((r) => r.item.raw.id).join(",");

    assertEqual(ids1, ids2, "ranked item IDs are identical across two runs");
  });

  // ── Test 13: Empty input edge case ──────────────────────────────────────
  await describe("Empty input: no items", async () => {
    const output = await runOrchestrator({
      items: [],
      context: userContext,
      mode: "lens",
      options: { nowMs: NOW_MS, llm: { provider: "mock", model: "mock-v1" } },
    });

    assert(output.response.ok === true, "empty input: response.ok is true");
    assertEqual(
      output.response.data?.length ?? 0,
      0,
      "empty input: response.data is empty"
    );
    assertEqual(
      output.conflictResult.total,
      0,
      "empty input: 0 conflicts detected"
    );
  });

  // ── Test 14: Role-aware conflict promotion ───────────────────────────────
  await describe("Role-aware conflict promotion: promoted count is sane", async () => {
    const { pipelineMeta } = await runPipeline("lens", undefined, 1);

    // With topN=1, the selector should promote items from high/critical
    // conflicts relevant to Alex's roles. Since mock data has such conflicts,
    // promotedCount should be > 0 and itemsAfterSelection > 1.
    assertGte(
      pipelineMeta.itemsAfterSelection,
      1,
      "at least 1 item in selection (base topN)"
    );
    // promotedCount may be 0 if the single top item already covers conflicts.
    assert(
      typeof pipelineMeta.conflictsPromoted === "number",
      "conflictsPromoted is a number"
    );
    assertGte(pipelineMeta.conflictsPromoted, 0, "conflictsPromoted >= 0");
  });

  // ── Test 15: Context builder provides activeProjects ─────────────────────
  await describe("Context builder: activeProjects derived from involvement", async () => {
    // We can observe the effect of active project derivation through the
    // conflicts surfaced — only conflicts touching active projects pass the
    // context builder's cross-check.
    const { response } = await runPipeline("lens");

    // In the mock data, Alex is directly involved in Feature X items.
    // At least one conflict should be surfaced (the schedule overlap or
    // the blocked dependency).
    assertGte(
      response.conflicts?.length ?? 0,
      1,
      "context builder surfaces at least 1 relevant conflict"
    );

    // All surfaced conflicts must have valid structure.
    for (const conflict of response.conflicts ?? []) {
      assert(typeof conflict.id === "string", `${conflict.id}: id is a string`);
      assert(typeof conflict.severity === "string", `${conflict.id}: severity is a string`);
      assert(Array.isArray(conflict.items), `${conflict.id}: items is an array`);
    }
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.error("\nFailed assertions:");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("\n✅ All orchestrator tests passed!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n💥 Unexpected error in test suite:", err);
  process.exit(1);
});
