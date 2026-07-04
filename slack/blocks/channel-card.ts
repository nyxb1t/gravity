/**
 * @file slack/blocks/channel-card.ts
 * @description Channel card block builder.
 *
 * Renders a summary card for a Slack channel, GitHub repository, Notion
 * workspace, or any other "source group" that Gravity tracks. Used in
 * overview screens to show the user which sources are active and their
 * unread/pending counts.
 *
 * Visual layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  # engineering              *3 unread* · Last: 4m ago  │  ← section + fields
 *   │  :slack: Slack                                [Browse] │
 *   └────────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildChannelCard } from "@/slack/blocks/channel-card";
 *
 * buildChannelCard({
 *   name: "engineering",
 *   source: "slack",
 *   url: "https://myteam.slack.com/channels/engineering",
 *   unreadCount: 3,
 *   lastActivityAt: "4 min ago",
 * });
 *
 * // GitHub repo variant
 * buildChannelCard({
 *   name: "org/gravity",
 *   source: "github",
 *   url: "https://github.com/org/gravity",
 *   unreadCount: 12,
 *   lastActivityAt: "Yesterday",
 *   showBrowseButton: false,
 * });
 * ```
 */

import type { KnownBlock } from "./kit";
import { mrkdwn, button, EMOJI } from "./kit";
import type { DataSource } from "@/types";

// ---------------------------------------------------------------------------
// Source display helpers
// ---------------------------------------------------------------------------

const SOURCE_EMOJI: Record<DataSource, string> = {
  slack:    EMOJI.slack,
  github:   EMOJI.github,
  notion:   EMOJI.notion,
  calendar: EMOJI.calendar,
  email:    EMOJI.email,
};

const SOURCE_LABEL: Record<DataSource, string> = {
  slack:    "Slack",
  github:   "GitHub",
  notion:   "Notion",
  calendar: "Google Calendar",
  email:    "Email",
};

// Channel/group name prefix per source for visual affordance
const SOURCE_PREFIX: Record<DataSource, string> = {
  slack:    "#",
  github:   "",   // repos use "org/name" format
  notion:   "",
  calendar: "",
  email:    "",
};

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface ChannelCardInput {
  /**
   * Name of the channel, repo, or workspace.
   * e.g. "engineering", "org/gravity", "Design System".
   */
  name: string;

  /** The integration this channel belongs to. */
  source: DataSource;

  /** URL that opens this channel/repo/page in its native application. */
  url: string;

  /**
   * Number of unread or pending items in this channel.
   * When 0 or omitted, the count row is suppressed.
   */
  unreadCount?: number;

  /**
   * Human-readable relative timestamp of the last activity.
   * e.g. "4 min ago", "Yesterday", "Jul 1".
   */
  lastActivityAt?: string;

  /**
   * Optional short description of the channel.
   * e.g. "Production incidents & on-call", "Public repo".
   */
  description?: string;

  /**
   * Whether to show a Browse action button.
   * Defaults to `true`.
   */
  showBrowseButton?: boolean;

  /**
   * Whether to highlight this card as muted.
   * When true, renders a visual indicator that the source is muted.
   * Defaults to `false`.
   */
  isMuted?: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a channel summary card as an array of Block Kit blocks.
 * Returns 1–2 blocks depending on whether an action button is shown.
 */
export function buildChannelCard(input: ChannelCardInput): KnownBlock[] {
  const showBrowse = input.showBrowseButton ?? true;
  const isMuted = input.isMuted ?? false;

  const prefix = SOURCE_PREFIX[input.source];
  const displayName = `${prefix}${input.name}`;
  const sourceInfo = `${SOURCE_EMOJI[input.source]} ${SOURCE_LABEL[input.source]}`;

  // ── Unread badge ──────────────────────────────────────────────────────────
  const unread = input.unreadCount ?? 0;
  const unreadText =
    unread > 0
      ? `*${unread} unread*`
      : "_No new items_";

  // ── Last activity ─────────────────────────────────────────────────────────
  const lastActivity = input.lastActivityAt
    ? `${EMOJI.time} ${input.lastActivityAt}`
    : "";

  // ── Muted indicator ──────────────────────────────────────────────────────
  const mutedSuffix = isMuted ? "  _· muted_" : "";

  // ── Title and metadata text ──────────────────────────────────────────────
  const titleText = `${EMOJI.channel} *<${input.url}|${displayName}>*${mutedSuffix}`;
  const metaLine = [sourceInfo, unreadText, lastActivity]
    .filter(Boolean)
    .join("  ·  ");

  const textContent = input.description
    ? `${titleText}\n${input.description}\n${metaLine}`
    : `${titleText}\n${metaLine}`;

  const sectionBlock: KnownBlock = {
    type: "section",
    text: mrkdwn(textContent),
    ...(showBrowse && {
      accessory: button("Browse", `browse_channel__${sanitizeId(input.name)}`, {
        url: input.url,
      }),
    }),
  };

  const blocks: KnownBlock[] = [sectionBlock];

  return blocks;
}

// ---------------------------------------------------------------------------
// Utilities (private)
// ---------------------------------------------------------------------------

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-.]/g, "_").slice(0, 200);
}
