/**
 * @file slack/blocks/priority-card.ts
 * @description Priority card block builder.
 *
 * Renders a single `WorkspaceItem` as a self-contained Slack card — the core
 * building block of Gravity's digest and inbox surfaces. Each card shows:
 *  - Priority badge (urgency band → coloured emoji dot)
 *  - Item title (linked to the source URL)
 *  - Snippet of the body text
 *  - Key metadata: source, author, channel, timestamp
 *  - Optional action row (open, dismiss, bookmark)
 *
 * Visual layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  🔴 <https://...|PR: Fix auth timeout> · #engineering  │  ← section
 *   │  "The token refresh logic fails when …"                 │
 *   │  GitHub · alice · 2 min ago            [Open] [···]   │  ← context + actions
 *   └────────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildPriorityCard } from "@/slack/blocks/priority-card";
 *
 * const blocks = buildPriorityCard({
 *   id:        "slack:C01:1718000000.000100",
 *   title:     "PR: Fix auth timeout in production",
 *   url:       "https://github.com/org/repo/pull/42",
 *   body:      "The token refresh logic fails when the network latency exceeds 5 s…",
 *   source:    "github",
 *   urgency:   "critical",
 *   author:    "alice",
 *   channel:   "engineering",
 *   timestamp: "2 min ago",
 *   showActions: true,
 * });
 * ```
 */

import type { KnownBlock } from "./kit";
import { mrkdwn, button, overflow, overflowOption, EMOJI } from "./kit";
import type { DataSource, UrgencyBand } from "@/types";

// ---------------------------------------------------------------------------
// Urgency helpers
// ---------------------------------------------------------------------------

const URGENCY_EMOJI: Record<UrgencyBand, string> = {
  critical:  EMOJI.critical,
  high:      EMOJI.high,
  medium:    EMOJI.medium,
  low:       EMOJI.low,
  dismissed: EMOJI.dismissed,
};

const URGENCY_LABEL: Record<UrgencyBand, string> = {
  critical:  "Critical",
  high:      "High",
  medium:    "Medium",
  low:       "Low",
  dismissed: "Dismissed",
};

const SOURCE_EMOJI: Record<DataSource, string> = {
  slack:    EMOJI.slack,
  github:   EMOJI.github,
  notion:   EMOJI.notion,
  calendar: EMOJI.calendar,
  email:    EMOJI.email,
};

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface PriorityCardInput {
  /**
   * Gravity item ID (namespaced, e.g. "slack:C01:1718000000.000100").
   * Used as the `value` and `action_id` suffix for action buttons so that
   * event handlers can identify which card was acted on.
   */
  id: string;

  /** Human-readable title of the item. Rendered as a linked hyperlink. */
  title: string;

  /** Source URL that opens the item in its native application. */
  url: string;

  /**
   * Snippet of the body text. Truncated to `maxBodyLength` characters.
   * Omit or pass an empty string to suppress the body row.
   */
  body?: string;

  /** The integration this item came from. Drives the source emoji. */
  source: DataSource;

  /** Urgency band drives the coloured dot prefix on the title. */
  urgency: UrgencyBand;

  /** Display name of the author. Omit if unknown or N/A. */
  author?: string;

  /**
   * Channel or logical grouping the item belongs to.
   * e.g. "#engineering", "org/repo", "My Notion workspace".
   */
  channel?: string;

  /**
   * Human-readable relative timestamp, e.g. "2 min ago", "Yesterday".
   * Formatted by the caller — this builder does no date arithmetic.
   */
  timestamp?: string;

  /**
   * Whether to show the Open / overflow action row below the card.
   * Defaults to `true`.
   */
  showActions?: boolean;

  /**
   * Maximum number of characters of `body` to display before truncating.
   * Defaults to 140.
   */
  maxBodyLength?: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a priority item card as an array of Block Kit blocks.
 * Returns 2–3 blocks depending on whether actions are shown.
 */
export function buildPriorityCard(input: PriorityCardInput): KnownBlock[] {
  const showActions = input.showActions ?? true;
  const maxLen = input.maxBodyLength ?? 140;

  // ── Title line ──────────────────────────────────────────────────────────
  const urgencyDot = URGENCY_EMOJI[input.urgency];
  const sourceEmoji = SOURCE_EMOJI[input.source];
  const channelSuffix = input.channel ? ` · _${input.channel}_` : "";

  const titleText =
    `${urgencyDot}  <${input.url}|${escapeTitle(input.title)}>${channelSuffix}`;

  // ── Body snippet ─────────────────────────────────────────────────────────
  const snippet =
    input.body && input.body.trim()
      ? truncate(input.body.trim(), maxLen)
      : undefined;

  const bodyText = snippet ? `\n>${snippet}` : "";

  // ── Section block ─────────────────────────────────────────────────────────
  const sectionBlock: KnownBlock = {
    type: "section",
    text: mrkdwn(`${titleText}${bodyText}`),
  };

  // ── Context row: source · author · time ──────────────────────────────────
  const contextParts: string[] = [
    `${sourceEmoji} *${formatSource(input.source)}*`,
  ];
  if (input.author) contextParts.push(`${EMOJI.person} ${input.author}`);
  if (input.timestamp) contextParts.push(`${EMOJI.time} ${input.timestamp}`);
  const urgencyLabel = `${URGENCY_LABEL[input.urgency]} priority`;
  contextParts.push(`_${urgencyLabel}_`);

  const contextBlock: KnownBlock = {
    type: "context",
    elements: [mrkdwn(contextParts.join("  ·  "))],
  };

  const blocks: KnownBlock[] = [sectionBlock, contextBlock];

  // ── Actions row ──────────────────────────────────────────────────────────
  if (showActions) {
    const safeId = sanitizeId(input.id);
    blocks.push({
      type: "actions",
      elements: [
        button("Open", `open_item__${safeId}`, {
          url: input.url,
          style: "primary",
        }),
        overflow(`more_actions__${safeId}`, [
          overflowOption("Bookmark", `bookmark__${safeId}`),
          overflowOption("Dismiss",  `dismiss__${safeId}`, "Remove from your digest"),
          overflowOption("Mark as read", `read__${safeId}`),
        ]),
      ],
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Utilities (private)
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function escapeTitle(title: string): string {
  // Slack link labels must not contain < > & characters unescaped.
  return title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeId(id: string): string {
  // action_id must be ≤ 255 chars and contain only safe characters.
  return id.replace(/[^a-zA-Z0-9_\-:.]/g, "_").slice(0, 200);
}

function formatSource(source: DataSource): string {
  const labels: Record<DataSource, string> = {
    slack:    "Slack",
    github:   "GitHub",
    notion:   "Notion",
    calendar: "Calendar",
    email:    "Email",
  };
  return labels[source];
}
