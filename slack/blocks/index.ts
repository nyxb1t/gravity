/**
 * @file slack/blocks/index.ts
 * @description Public barrel for Gravity's Block Kit component library.
 *
 * Import all block builders from this single file. Never import from
 * individual block files in consumer code (commands, events, home) —
 * always use this barrel so that refactors stay contained here.
 *
 * @example
 * ```ts
 * import {
 *   buildHeaderBlock,
 *   buildDividerBlock,
 *   buildPriorityCard,
 *   buildAlertCard,
 *   buildChannelCard,
 *   buildPersonCard,
 *   buildSectionBlock,
 *   buildEmptyState,
 * } from "@/slack/blocks";
 * ```
 */

// ── Primitive utilities (for advanced consumers) ──────────────────────────
export { mrkdwn, plainText, imageElement, button, overflow, overflowOption, EMOJI } from "./kit";
export type { KnownBlock, Block, ButtonStyle, EmojiKey } from "./kit";

// ── Layout primitives ─────────────────────────────────────────────────────
export { buildHeaderBlock }  from "./header";
export type { HeaderBlockInput }  from "./header";

export { buildDividerBlock } from "./divider";
export type { DividerBlockInput } from "./divider";

export { buildSectionBlock } from "./section";
export type { SectionBlockInput, SectionField, AccessoryElement } from "./section";

// ── Item cards ────────────────────────────────────────────────────────────
export { buildPriorityCard } from "./priority-card";
export type { PriorityCardInput } from "./priority-card";

export { buildAlertCard }    from "./alert-card";
export type { AlertCardInput, AlertCardAction, AlertType } from "./alert-card";

export { buildChannelCard }  from "./channel-card";
export type { ChannelCardInput } from "./channel-card";

export { buildPersonCard }   from "./person-card";
export type { PersonCardInput } from "./person-card";

// ── Utility screens ───────────────────────────────────────────────────────
export { buildEmptyState }   from "./empty-state";
export type { EmptyStateInput, EmptyStateAction } from "./empty-state";

