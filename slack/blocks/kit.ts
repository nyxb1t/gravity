/**
 * @file slack/blocks/kit.ts
 * @description Low-level Block Kit element factories used internally by all
 * block builders in this directory.
 *
 * Rules for this file:
 *  ✓ Pure functions — no side effects, no imports from outside this directory.
 *  ✓ Every function returns a strict, typed Block Kit element object.
 *  ✗ Do NOT import business logic, API clients, or shared types here.
 *  ✗ Do NOT export from slack/blocks/index.ts — this is an internal module.
 *
 * Consumers should import from individual builder files (header.ts, etc.),
 * not from this file directly.
 */

import type { KnownBlock, Block, PlainTextElement, MrkdwnElement } from "@slack/types";

// Re-export for builder files so they have a single import source.
export type { KnownBlock, Block, PlainTextElement, MrkdwnElement };

// ---------------------------------------------------------------------------
// Text element helpers
// ---------------------------------------------------------------------------

/** Creates a plain_text element. Emoji is enabled by default. */
export function plainText(text: string, emoji = true): PlainTextElement {
  return { type: "plain_text", text, emoji };
}

/** Creates an mrkdwn element. Verbatim mode is off by default. */
export function mrkdwn(text: string, verbatim = false): MrkdwnElement {
  return { type: "mrkdwn", text, verbatim };
}

// ---------------------------------------------------------------------------
// Image element
// ---------------------------------------------------------------------------

/** Inline image element (used inside context or accessory blocks). */
export interface ImageElement {
  type: "image";
  image_url: string;
  alt_text: string;
}

export function imageElement(url: string, altText: string): ImageElement {
  return { type: "image", image_url: url, alt_text: altText };
}

// ---------------------------------------------------------------------------
// Button element
// ---------------------------------------------------------------------------

/** Style options for button elements. */
export type ButtonStyle = "primary" | "danger" | "default";

export interface ButtonElement {
  type: "button";
  text: PlainTextElement;
  action_id: string;
  value?: string;
  url?: string;
  style?: "primary" | "danger";
}

/**
 * Creates a button element for use inside an `actions` block.
 * `style: "default"` omits the style key (Slack treats absence as default).
 */
export function button(
  label: string,
  actionId: string,
  opts: {
    value?: string;
    url?: string;
    style?: ButtonStyle;
  } = {}
): ButtonElement {
  const el: ButtonElement = {
    type: "button",
    text: plainText(label),
    action_id: actionId,
  };
  if (opts.value) el.value = opts.value;
  if (opts.url) el.url = opts.url;
  if (opts.style && opts.style !== "default") el.style = opts.style;
  return el;
}

// ---------------------------------------------------------------------------
// Overflow menu option
// ---------------------------------------------------------------------------

export interface OverflowOption {
  text: PlainTextElement;
  value: string;
  description?: PlainTextElement;
  url?: string;
}

export function overflowOption(
  label: string,
  value: string,
  description?: string
): OverflowOption {
  const opt: OverflowOption = { text: plainText(label), value };
  if (description) opt.description = plainText(description);
  return opt;
}

// ---------------------------------------------------------------------------
// Overflow menu element
// ---------------------------------------------------------------------------

export interface OverflowElement {
  type: "overflow";
  action_id: string;
  options: OverflowOption[];
}

export function overflow(actionId: string, options: OverflowOption[]): OverflowElement {
  return { type: "overflow", action_id: actionId, options };
}

// ---------------------------------------------------------------------------
// Emoji constants
// (Slack mrkdwn uses :name: notation — centralise them to avoid typos)
// ---------------------------------------------------------------------------

export const EMOJI = {
  gravity:    ":sparkles:",
  critical:   ":red_circle:",
  high:       ":large_orange_circle:",
  medium:     ":large_yellow_circle:",
  low:        ":white_circle:",
  dismissed:  ":no_entry_sign:",
  slack:      ":slack:",
  github:     ":github:",
  notion:     ":notion:",
  calendar:   ":calendar:",
  email:      ":email:",
  mention:    ":bell:",
  message:    ":speech_balloon:",
  pr_review:  ":eyes:",
  issue:      ":bug:",
  commit:     ":hammer:",
  page_edit:  ":memo:",
  comment:    ":speech_balloon:",
  event:      ":clock1:",
  notification: ":bell:",
  person:     ":bust_in_silhouette:",
  channel:    ":hash:",
  empty:      ":inbox_tray:",
  warning:    ":warning:",
  info:       ":information_source:",
  success:    ":white_check_mark:",
  error:      ":x:",
  link:       ":link:",
  time:       ":clock3:",
} as const;

export type EmojiKey = keyof typeof EMOJI;
