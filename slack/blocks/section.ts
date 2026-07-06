/**
 * @file slack/blocks/section.ts
 * @description General-purpose section block builder.
 *
 * Covers the full surface of Slack's `section` block type:
 *  - Main body text (mrkdwn)
 *  - Optional two-column field pairs
 *  - Optional accessory element (button, image, overflow)
 *  - Optional context row beneath the section
 *
 * Visual layout variants:
 *
 *  Text only:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Body text with *mrkdwn* support                   │
 *   └─────────────────────────────────────────────────────┘
 *
 *  Text + accessory:
 *   ┌────────────────────────────────────┬────────────────┐
 *   │  Body text                         │  [Accessory]  │
 *   └────────────────────────────────────┴────────────────┘
 *
 *  Fields only (two columns):
 *   ┌───────────────────────┬────────────────────────────┐
 *   │  *Label A*            │  *Label B*                 │
 *   │  Value A              │  Value B                   │
 *   └───────────────────────┴────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildSectionBlock } from "@/slack/blocks/section";
 * import { button } from "@/slack/blocks/kit";
 *
 * // Simple text section
 * buildSectionBlock({ text: "Hello, *Gravity*!" });
 *
 * // Text + button accessory
 * buildSectionBlock({
 *   text: "You have 3 unread mentions.",
 *   accessory: button("View all", "view_mentions"),
 * });
 *
 * // Two-column fields
 * buildSectionBlock({
 *   fields: [
 *     { label: "Source", value: "Slack" },
 *     { label: "Priority", value: ":red_circle: Critical" },
 *   ],
 * });
 * ```
 */

import type { KnownBlock, MrkdwnElement } from "./kit";
import { mrkdwn } from "./kit";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A labelled key-value pair rendered in the section's `fields` array. */
export interface SectionField {
  /** Bold label text. */
  label: string;
  /** Value text. Supports mrkdwn. */
  value: string;
}

/** Any valid Block Kit accessory element. Keep loosely typed to stay Bolt-agnostic. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AccessoryElement = Record<string, any>;

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface SectionBlockInput {
  /**
   * Main body text. Supports mrkdwn (bold, italic, links, emojis).
   * Required when `fields` is not provided.
   */
  text?: string;

  /**
   * Up to 10 two-column key-value pairs.
   * Slack renders each field as `*Label*\nValue`.
   * Required when `text` is not provided.
   */
  fields?: SectionField[];

  /**
   * Optional accessory element displayed to the right of the text.
   * Use `button()`, `imageElement()`, or `overflow()` from kit.ts.
   */
  accessory?: AccessoryElement;

  /**
   * Optional context row rendered beneath the section.
   * Each string is an mrkdwn element in the context block.
   */
  context?: string[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a section block (+ optional context block) as an array of blocks.
 *
 * Returns 1 block when no `context` is provided, 2 when it is.
 */
export function buildSectionBlock(input: SectionBlockInput): KnownBlock[] {
  if (!input.text && (!input.fields || input.fields.length === 0)) {
    throw new Error(
      "[buildSectionBlock] Either `text` or `fields` must be provided."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block: Record<string, any> = { type: "section" };

  if (input.text) {
    block["text"] = mrkdwn(input.text);
  }

  if (input.fields && input.fields.length > 0) {
    block["fields"] = input.fields.map(
      (f): MrkdwnElement => mrkdwn(`*${f.label}*\n${f.value}`)
    );
  }

  if (input.accessory) {
    block["accessory"] = input.accessory;
  }

  const blocks: KnownBlock[] = [block as KnownBlock];

  if (input.context && input.context.length > 0) {
    blocks.push({
      type: "context",
      elements: input.context.map((c) => mrkdwn(c)),
    });
  }

  return blocks;
}
