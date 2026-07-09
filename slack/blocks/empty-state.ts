/**
 * @file slack/blocks/empty-state.ts
 * @description Empty state block builder.
 *
 * Renders a friendly, informative placeholder when a list or panel has no
 * items to display. Used wherever Gravity surfaces might be empty:
 *  - No unread items in digest
 *  - No conflicts detected
 *  - No results for a search query
 *  - No connected integrations
 *
 * Visual layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                    📭                                    │  ← context (emoji)
 *   │            *You're all caught up!*                       │  ← section
 *   │  No new items across your connected integrations.        │
 *   │  Check back later or adjust your filters.               │
 *   │                  [Adjust Filters]                        │  ← actions (optional)
 *   └─────────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildEmptyState } from "@/slack/blocks/empty-state";
 *
 * // Default "all caught up" state
 * buildEmptyState({
 *   title: "You're all caught up!",
 *   message: "No new items across your connected integrations.",
 *   hint: "Check back later or adjust your priority filters.",
 * });
 *
 * // Custom search empty state with an action
 * buildEmptyState({
 *   emoji: ":mag:",
 *   title: "No results found",
 *   message: 'Nothing matched "*authentication bug*".',
 *   hint: "Try a different search term or broaden your filters.",
 *   action: { label: "Clear Search", actionId: "clear_search" },
 * });
 *
 * // No integrations connected
 * buildEmptyState({
 *   emoji: ":electric_plug:",
 *   title: "No integrations connected",
 *   message: "Connect GitHub, Notion, or Calendar to start seeing items here.",
 *   action: { label: "Connect Integrations", actionId: "open_settings" },
 * });
 * ```
 */

import type { KnownBlock } from "./kit";
import { mrkdwn, button, EMOJI } from "./kit";

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface EmptyStateAction {
  /** Label text for the call-to-action button. */
  label: string;

  /** Bolt action_id for the button. */
  actionId: string;

  /** Optional external URL to open (e.g. settings page). */
  url?: string;
}

export interface EmptyStateInput {
  /**
   * Main heading text rendered in bold.
   * e.g. "You're all caught up!", "No results found".
   */
  title: string;

  /**
   * Body explanation text. Supports mrkdwn.
   * Should describe *why* the state is empty in 1–2 sentences.
   */
  message: string;

  /**
   * Optional secondary hint rendered as smaller italic text.
   * Useful for actionable suggestions like "Try adjusting your filters".
   */
  hint?: string;

  /**
   * Slack emoji shortcode used as the visual anchor above the title.
   * Defaults to `:inbox_tray:` (📥).
   */
  emoji?: string;

  /**
   * Optional call-to-action button displayed below the empty state.
   * Use to guide the user towards a resolution.
   */
  action?: EmptyStateAction;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds an empty state panel as an array of Block Kit blocks.
 * Returns 2–4 blocks depending on whether hint and action are provided.
 */
export function buildEmptyState(input: EmptyStateInput): KnownBlock[] {
  const emoji = input.emoji ?? EMOJI.empty;

  // ── Large emoji anchor ────────────────────────────────────────────────────
  const emojiBlock: KnownBlock = {
    type: "context",
    elements: [mrkdwn(emoji)],
  };

  // ── Title + message section ───────────────────────────────────────────────
  const bodyText = `*${input.title}*\n${input.message}`;
  const sectionBlock: KnownBlock = {
    type: "section",
    text: mrkdwn(bodyText),
  };

  const blocks: KnownBlock[] = [emojiBlock, sectionBlock];

  // ── Hint context row ──────────────────────────────────────────────────────
  if (input.hint) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(`_${input.hint}_`)],
    });
  }

  // ── Optional CTA button ───────────────────────────────────────────────────
  if (input.action) {
    blocks.push({
      type: "actions",
      elements: [
        button(input.action.label, input.action.actionId, {
          url: input.action.url,
        }),
      ],
    });
  }

  return blocks;
}
