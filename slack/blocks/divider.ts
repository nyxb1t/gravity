/**
 * @file slack/blocks/divider.ts
 * @description Divider block builder.
 *
 * A thin horizontal rule used to visually separate sections. Wrapping the
 * Slack primitive in a named builder keeps the pattern consistent and allows
 * conditional rendering logic to be added later without changing call sites.
 *
 * @example
 * ```ts
 * import { buildDividerBlock } from "@/slack/blocks/divider";
 *
 * const blocks: KnownBlock[] = [
 *   ...buildHeaderBlock({ title: "Inbox" }),
 *   buildDividerBlock(),          // full divider
 *   buildDividerBlock({ if: items.length > 0 }),  // conditional divider
 * ];
 * ```
 */

import type { KnownBlock } from "./kit";

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface DividerBlockInput {
  /**
   * Conditional guard — when `false` the builder returns an empty array,
   * allowing callers to write `buildDividerBlock({ if: someCondition })`
   * without an explicit ternary.
   *
   * Defaults to `true` (always rendered).
   */
  if?: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** The singleton divider block object (stateless, safe to reuse). */
const DIVIDER_BLOCK: KnownBlock = { type: "divider" };

/**
 * Returns a divider block as an array for consistent spread usage.
 * Returns an empty array when `input.if` is `false`.
 */
export function buildDividerBlock(input: DividerBlockInput = {}): KnownBlock[] {
  const guard = input.if ?? true;
  return guard ? [DIVIDER_BLOCK] : [];
}
