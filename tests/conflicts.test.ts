/**
 * @file tests/conflicts.test.ts
 * @description Conflict Detection Engine test suite.
 *
 * Runs against the mock data in `data/mock.ts`. Every test is a plain
 * assertion that throws on failure — no third-party test runner required.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json -e "require('./tests/conflicts.test.ts')"
 *
 * Or via the npm script:
 *   npm run test:conflicts
 */

import { getMockData } from "../data/mock";
import { detectConflicts, detectConflictsRaw } from "../ai/conflicts";
import type { DetectedConflict } from "../ai/conflicts";
import type { WorkspaceItem, UserContext } from "../types";

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
  assert(actual === expected, `${label} (expected: ${expected}, got: ${actual})`);
}

function assertGte(actual: number, threshold: number, label: string): void {
  assert(actual >= threshold, `${label} (expected >= ${threshold}, got: ${actual})`);
}

function describe(name: string, fn: () => void): void {
  console.log(`\n▶ ${name}`);
  fn();
}

// ---------------------------------------------------------------------------
// Fixed reference time so scores and deadlines are deterministic
// ---------------------------------------------------------------------------

// Use a fixed "now" so all relative timestamps in mock.ts are stable.
const NOW = new Date("2026-07-01T00:00:00.000Z");
const NOW_MS = NOW.getTime();

const { items: normalizedItems, userContext } = getMockData(NOW);

// ---------------------------------------------------------------------------
// Helper: run engine once
// ---------------------------------------------------------------------------

const result = detectConflicts(normalizedItems, userContext, NOW_MS);

// ---------------------------------------------------------------------------
// Test 1: Engine produces a result envelope
// ---------------------------------------------------------------------------

describe("ConflictDetectionResult shape", () => {
  assert(result !== null && typeof result === "object", "result is an object");
  assert(Array.isArray(result.conflicts), "result.conflicts is an array");
  assertEqual(result.total, result.conflicts.length, "result.total matches conflicts.length");
  assert(typeof result.summary === "object", "result.summary is an object");
  assert(typeof result.detectedAt === "string", "result.detectedAt is a string");
  assert(typeof result.engineVersion === "string", "result.engineVersion is a string");

  // Summary counts must add up to total.
  const { critical, high, medium, low } = result.summary;
  assertEqual(
    critical + high + medium + low,
    result.total,
    "summary band counts sum to total"
  );
});

// ---------------------------------------------------------------------------
// Test 2: Schedule / deadline conflict detection
// ---------------------------------------------------------------------------

describe("Calendar overlap detection", () => {
  const scheduleConflicts = result.conflicts.filter(
    (c) => c.kind === "conflicting_deadlines" && c.type === "schedule"
  );

  assertGte(scheduleConflicts.length, 1, "at least one schedule conflict detected");

  // The mock data has a clear overlap between emergency-sync (starts in 30m)
  // and all-hands (starts in 15m, ends in 75m).
  const overlapConflict = scheduleConflicts.find((c) =>
    c.relatedItemIds.includes("calendar:event:emergency-sync") &&
    c.relatedItemIds.includes("calendar:event:all-hands")
  );

  assert(overlapConflict !== undefined, "emergency-sync ↔ all-hands overlap is detected");

  if (overlapConflict) {
    assertEqual(overlapConflict.severity, "critical", "overlap conflict severity is critical");
    assertGte(overlapConflict.suggestedActions.length, 1, "at least 1 suggested action");
    assert(overlapConflict.explanation.length > 0, "explanation is non-empty");
    assert(overlapConflict.relatedItemIds.length >= 2, "relatedItemIds contains both items");
  }
});

// ---------------------------------------------------------------------------
// Test 3: Blocked dependency detection
// ---------------------------------------------------------------------------

describe("Blocked dependency detection", () => {
  const depConflicts = result.conflicts.filter(
    (c) => c.kind === "blocked_dependency"
  );

  assertGte(depConflicts.length, 1, "at least one dependency conflict detected");

  // PR #240 (user's PR, isBlocked) should be flagged.
  const blockedPrConflict = depConflicts.find((c) =>
    c.relatedItemIds.includes("github:company/feature-x-repo:pr:240")
  );
  assert(blockedPrConflict !== undefined, "user's blocked PR #240 is detected");

  // GitHub blocker issue #245 should be surfaced as an active blocker.
  const blockerConflict = depConflicts.find((c) =>
    c.relatedItemIds.includes("github:company/feature-x-repo:issue:245")
  );
  assert(blockerConflict !== undefined, "blocker issue #245 is surfaced");

  if (blockedPrConflict) {
    assert(
      blockedPrConflict.severity === "critical" || blockedPrConflict.severity === "high",
      "blocked PR conflict is high or critical severity"
    );
    assertGte(blockedPrConflict.suggestedActions.length, 1, "blocked PR has suggested actions");
  }
});

// ---------------------------------------------------------------------------
// Test 4: Missing approval detection
// ---------------------------------------------------------------------------

describe("Missing approval detection", () => {
  const approvalConflicts = result.conflicts.filter(
    (c) => c.kind === "missing_approval"
  );

  assertGte(approvalConflicts.length, 1, "at least one approval conflict detected");

  // Notion spec page requires Alex's approval and has a 2-hour deadline.
  const notionApprovalConflict = approvalConflicts.find((c) =>
    c.relatedItemIds.includes("notion:page:feature-x-spec")
  );
  assert(notionApprovalConflict !== undefined, "Notion spec approval conflict detected");

  if (notionApprovalConflict) {
    assertEqual(
      notionApprovalConflict.severity,
      "critical",
      "Notion spec approval is critical (2h deadline)"
    );
    assert(
      notionApprovalConflict.explanation.includes("approval"),
      "explanation mentions approval"
    );
    assertGte(
      notionApprovalConflict.suggestedActions.length,
      1,
      "Notion approval conflict has suggested actions"
    );
  }
});

// ---------------------------------------------------------------------------
// Test 5: Critical issue detection
// ---------------------------------------------------------------------------

describe("Critical issue detection", () => {
  const criticalConflicts = result.conflicts.filter(
    (c) => c.kind === "critical_issue"
  );

  assertGte(criticalConflicts.length, 1, "at least one critical issue conflict detected");

  // GitHub issue #245 is the WebSocket crash — tagged as blocker/critical.
  const wsConflict = criticalConflicts.find((c) =>
    c.relatedItemIds.includes("github:company/feature-x-repo:issue:245")
  );
  assert(wsConflict !== undefined, "WebSocket crash issue #245 detected as critical");

  if (wsConflict) {
    assert(
      wsConflict.severity === "critical" || wsConflict.severity === "high",
      "WebSocket issue has high or critical severity"
    );
    assert(
      wsConflict.explanation.length > 50,
      "explanation is substantive (>50 chars)"
    );
  }

  // The Slack blocker message is tagged "blocker" — this routes it through
  // the dependency rule (not critical_issue), since its body lacks
  // outage/incident keywords. Verify it's captured somewhere in the result.
  const slackBlockerInResult = result.conflicts.find((c) =>
    c.relatedItemIds.includes("slack:C01234567:1718000000.000100")
  );
  assert(
    slackBlockerInResult !== undefined,
    "Slack blocker message is surfaced in at least one conflict (dependency or critical)"
  );
});

// ---------------------------------------------------------------------------
// Test 6: Assignment conflict detection
// ---------------------------------------------------------------------------

describe("Assignment conflict detection", () => {
  const assignConflicts = result.conflicts.filter(
    (c) => c.kind === "assignment_conflict"
  );

  assertGte(assignConflicts.length, 1, "at least one assignment conflict detected");

  // The user (Alex) is assigned to: PR #240 (blocked, isBlocked), issue #245 (blocker, isBlocker).
  // This should trigger a sequencing trap (Scenario B of assignmentConflict rule).
  const seqTrapConflict = assignConflicts.find(
    (c) =>
      c.type === "dependency" &&
      c.relatedItemIds.some((id) => id.includes("issue:245")) &&
      c.relatedItemIds.some((id) => id.includes("pr:240"))
  );

  assert(seqTrapConflict !== undefined, "sequencing trap detected (issue:245 ↔ pr:240)");

  if (seqTrapConflict) {
    assertGte(
      seqTrapConflict.suggestedActions.length,
      1,
      "sequencing trap has suggested actions"
    );
  }
});

// ---------------------------------------------------------------------------
// Test 7: Structural invariants on every conflict
// ---------------------------------------------------------------------------

describe("Structural invariants (all conflicts)", () => {
  for (const conflict of result.conflicts) {
    assert(typeof conflict.id === "string" && conflict.id.startsWith("conflict:"), `${conflict.id}: id starts with 'conflict:'`);
    assert(conflict.items.length >= 1, `${conflict.id}: has at least 1 item`);
    assert(conflict.relatedItemIds.length >= 1, `${conflict.id}: relatedItemIds non-empty`);
    assert(typeof conflict.explanation === "string" && conflict.explanation.length > 0, `${conflict.id}: explanation is non-empty string`);
    assert(Array.isArray(conflict.suggestedActions) && conflict.suggestedActions.length > 0, `${conflict.id}: has at least 1 suggested action`);
    assert(conflict.severityScore >= 0 && conflict.severityScore <= 1, `${conflict.id}: severityScore in [0,1]`);
    assert(typeof conflict.acknowledged === "boolean", `${conflict.id}: acknowledged is boolean`);

    // relatedItemIds must be a subset of items[].id
    const itemIdSet = new Set(conflict.items.map((i) => i.id));
    for (const rid of conflict.relatedItemIds) {
      assert(itemIdSet.has(rid), `${conflict.id}: relatedItemId "${rid}" is present in items[]`);
    }

    // Each suggested action must have a label and rationale.
    for (const action of conflict.suggestedActions) {
      assert(
        typeof action.label === "string" && action.label.length > 0,
        `${conflict.id}: action label is non-empty`
      );
      assert(
        typeof action.rationale === "string" && action.rationale.length > 0,
        `${conflict.id}: action rationale is non-empty`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Test 8: Deduplication — same conflict ID appears only once
// ---------------------------------------------------------------------------

describe("Deduplication", () => {
  const idCounts = new Map<string, number>();
  for (const c of result.conflicts) {
    idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  }

  Array.from(idCounts.entries()).forEach(([id, count]) => {
    assertEqual(count, 1, `conflict id "${id}" appears exactly once`);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Sort order — severity descending
// ---------------------------------------------------------------------------

describe("Sort order (severity descending)", () => {
  for (let i = 0; i < result.conflicts.length - 1; i++) {
    const a = result.conflicts[i];
    const b = result.conflicts[i + 1];
    assert(
      a.severityScore >= b.severityScore,
      `conflict[${i}] (${a.severity}, score=${a.severityScore}) >= conflict[${i+1}] (${b.severity}, score=${b.severityScore})`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 10: Determinism — same input same output
// ---------------------------------------------------------------------------

describe("Determinism (same input → same output)", () => {
  const result2 = detectConflicts(normalizedItems, userContext, NOW_MS);
  assertEqual(result2.total, result.total, "total conflicts is identical on second run");
  assertEqual(
    result2.conflicts.map((c) => c.id).join(","),
    result.conflicts.map((c) => c.id).join(","),
    "conflict IDs are identical and in same order"
  );
});

// ---------------------------------------------------------------------------
// Test 11: Raw items API
// ---------------------------------------------------------------------------

describe("detectConflictsRaw API", () => {
  const rawItems: WorkspaceItem[] = normalizedItems.map((n) => n.raw);
  const rawResult = detectConflictsRaw(rawItems, userContext, NOW_MS);

  assertEqual(rawResult.total, result.total, "raw API yields same total as normalized API");
  assertEqual(
    rawResult.conflicts.map((c) => c.id).join(","),
    result.conflicts.map((c) => c.id).join(","),
    "raw API yields same conflict IDs in same order"
  );
});

// ---------------------------------------------------------------------------
// Test 12: No conflicts from empty input
// ---------------------------------------------------------------------------

describe("Empty input edge case", () => {
  const emptyResult = detectConflicts([], userContext, NOW_MS);
  assertEqual(emptyResult.total, 0, "empty input produces 0 conflicts");
  assertEqual(emptyResult.summary.critical, 0, "empty input: critical = 0");
  assertEqual(emptyResult.summary.high, 0, "empty input: high = 0");
});

// ---------------------------------------------------------------------------
// Test 13: Closed items are not flagged
// ---------------------------------------------------------------------------

describe("Closed items are ignored", () => {
  const rawItems: WorkspaceItem[] = normalizedItems.map((n) => ({
    ...n.raw,
    metadata: { ...n.raw.metadata, status: "closed" },
  }));

  const closedResult = detectConflictsRaw(rawItems, userContext, NOW_MS);

  // With everything closed, most conflict types should not fire.
  // (Schedule overlaps may still fire as they depend on event timestamps, not status.)
  const nonScheduleConflicts = closedResult.conflicts.filter(
    (c) => c.type !== "schedule"
  );

  assertEqual(
    nonScheduleConflicts.length,
    0,
    "no non-schedule conflicts when all items are closed"
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.error("\nFailed assertions:");
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log("\n✅ All tests passed!");
  process.exit(0);
}
