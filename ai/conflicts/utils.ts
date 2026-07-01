/**
 * @file ai/conflicts/utils.ts
 * @description Shared utility functions for all conflict detection rules.
 *
 * All functions are pure (no side effects, no I/O) so they are trivially
 * testable and safe to call from any rule.
 */

import type { WorkspaceItem } from "@/types";
import type { RuleContext } from "./types";

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of identity strings for the current user across all
 * connected accounts.
 *
 * Used to check participant lists across different provider ID formats
 * (e.g. "alexchen-dev" for GitHub vs "U01AM3K8S" for Slack).
 */
function getUserIdentities(context: RuleContext): Set<string> {
  const ids = new Set<string>([
    context.userId,
    context.email,
  ]);

  for (const [, providerUserId] of Object.entries(context.connectedAccounts)) {
    if (providerUserId) ids.add(providerUserId);
  }

  return ids;
}

/**
 * Returns true when any of the user's known identity strings match the
 * given participant/author ID.
 */
function matchesUser(id: string, identities: Set<string>): boolean {
  return identities.has(id);
}

// ---------------------------------------------------------------------------
// Assignment checks
// ---------------------------------------------------------------------------

/**
 * Returns true when the user is the PRIMARY assignee of the item.
 *
 * Primary = participant with role "assignee" OR author of the item.
 */
export function isPrimaryAssignee(
  item: WorkspaceItem,
  context: RuleContext
): boolean {
  const ids = getUserIdentities(context);

  // Author is effectively the owner of self-authored items.
  if (item.author && matchesUser(item.author.id, ids)) return true;

  return item.participants.some(
    (p) => matchesUser(p.id, ids) && p.role === "assignee"
  );
}

/**
 * Returns true when the user is assigned to the item in any capacity
 * (primary assignee, reviewer, attendee, or author).
 */
export function isAssignedToUser(
  item: WorkspaceItem,
  context: RuleContext
): boolean {
  const ids = getUserIdentities(context);

  if (item.author && matchesUser(item.author.id, ids)) return true;

  return item.participants.some((p) => matchesUser(p.id, ids));
}

/**
 * Returns true when the user is a reviewer or approver on the item.
 *
 * Checks:
 *  - participant role is "reviewer" | "approver" | "approver_required"
 *  - user is any participant on a Notion page (where every editor can approve)
 */
export function isReviewerOrApprover(
  item: WorkspaceItem,
  context: RuleContext
): boolean {
  const ids = getUserIdentities(context);

  const REVIEWER_ROLES = new Set([
    "reviewer",
    "approver",
    "approver_required",
    "required_reviewer",
  ]);

  const isExplicitReviewer = item.participants.some(
    (p) =>
      matchesUser(p.id, ids) &&
      (p.role === undefined ||
        p.role === "" ||
        REVIEWER_ROLES.has(p.role.toLowerCase()))
  );

  // For Notion pages, any listed participant is implicitly an approver.
  if (item.source === "notion" && isAssignedToUser(item, context)) return true;

  return isExplicitReviewer;
}

// ---------------------------------------------------------------------------
// Item state helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the item is in a terminal (closed/resolved/done) state.
 *
 * Checks `metadata.status`, `metadata.state`, and `metadata.merged`
 * (for PRs).
 */
export function isItemClosed(item: WorkspaceItem): boolean {
  const status = String(item.metadata.status ?? "").toLowerCase();
  const state = String(item.metadata.state ?? "").toLowerCase();

  const CLOSED_STATES = new Set([
    "closed",
    "resolved",
    "done",
    "completed",
    "merged",
    "cancelled",
    "canceled",
    "fixed",
  ]);

  if (CLOSED_STATES.has(status) || CLOSED_STATES.has(state)) return true;
  if (item.metadata.merged === true) return true;
  if (item.metadata.closed === true) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Deadline resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the most appropriate deadline timestamp for an item.
 *
 * Resolution order:
 *  1. `metadata.dueDate`    — explicit due date (GitHub issues, Notion, etc.)
 *  2. `metadata.eventEnd`   — end of a calendar event
 *  3. `metadata.deadline`   — generic deadline key
 *
 * Returns null when no deadline information is available.
 */
export function resolveDeadlineMs(item: WorkspaceItem): number | null {
  const candidates = [
    item.metadata.dueDate,
    item.metadata.eventEnd,
    item.metadata.deadline,
  ] as Array<unknown>;

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const ms = new Date(candidate).getTime();
      if (!isNaN(ms)) return ms;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conflict ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a stable, deterministic conflict ID from a prefix and one or
 * more item IDs.
 *
 * The IDs are sorted before hashing so the result is order-independent
 * (conflict between A and B == conflict between B and A).
 *
 * Format: `conflict:{prefix}:{sortedIdHash}`
 *
 * Uses a simple djb2-style hash for determinism without depending on crypto.
 */
export function generateConflictId(prefix: string, ...itemIds: string[]): string {
  const sorted = [...itemIds].sort().join("|");
  const hash = djb2Hash(sorted);
  return `conflict:${prefix}:${hash}`;
}

/**
 * djb2 hash — fast, deterministic, and sufficient for conflict ID stability.
 * Returns a 32-bit unsigned integer encoded as an 8-character hex string.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // Force unsigned 32-bit.
  }
  return hash.toString(16).padStart(8, "0");
}
