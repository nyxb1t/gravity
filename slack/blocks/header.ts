/**
 * @file slack/blocks/header.ts
 * @description Page header block builder.
 *
 * Produces a header block (large bold text) with an optional context line
 * below it for subtitles, page descriptions, or live timestamps.
 *
 * Visual layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ✦  Your Title                             [emoji]  │  ← header block
 *   │  Your subtitle or description text                   │  ← context block
 *   └──────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildHeaderBlock } from "@/slack/blocks/header";
 *
 * const blocks = buildHeaderBlock({
 *   title: "Gravity — Your Workspace Digest",
 *   subtitle: "Showing 12 items · Last synced 2 min ago",
 *   emoji: ":sparkles:",
 * });
 * ```
 */

import type { KnownBlock } from "./kit";
import { plainText, mrkdwn, EMOJI } from "./kit";

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface HeaderBlockInput {
  /**
   * Main heading text. Displayed as a large bold title.
   * Keep under 150 characters — Slack truncates header blocks at 150 chars.
   */
  title: string;

  /**
   * Optional subtitle rendered in a context block beneath the header.
   * Supports mrkdwn (bold, italic, links).
   */
  subtitle?: string;

  /**
   * Slack emoji shortcode prepended to the title. Defaults to `:sparkles:`.
   * Pass an empty string to suppress the emoji.
   */
  emoji?: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a page header as an array of Block Kit blocks.
 *
 * Returns 1 block when `subtitle` is omitted, 2 blocks when it is provided.
 * Always returns an array so the caller can spread directly into a block list:
 *
 * ```ts
 * const blocks: KnownBlock[] = [
 *   ...buildHeaderBlock({ title: "Inbox" }),
 *   buildDividerBlock(),
 *   // ...more blocks
 * ];
 * ```
 */
export function buildHeaderBlock(input: HeaderBlockInput): KnownBlock[] {
  const prefix =
    input.emoji === undefined
      ? `${EMOJI.gravity} `
      : input.emoji
      ? `${input.emoji} `
      : "";

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: plainText(`${prefix}${input.title}`),
    },
  ];

  if (input.subtitle) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(input.subtitle)],
    });
  }

  return blocks;
}
