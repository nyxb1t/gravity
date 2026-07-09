/**
 * @file slack/blocks/person-card.ts
 * @description Person card block builder.
 *
 * Renders a compact profile card for a collaborator — used in Gravity's
 * "Who's active" panels, assignee lists, and author attribution rows.
 *
 * Visual layout:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  [avatar]  *Alice Chen*  ·  @alice                        │  ← section
 *   │            Senior Engineer  ·  Engineering                │
 *   │            :slack: :github:  ·  Last seen: 10 min ago     │  ← context
 *   └───────────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildPersonCard } from "@/slack/blocks/person-card";
 *
 * // Full card with avatar
 * buildPersonCard({
 *   displayName: "Alice Chen",
 *   slackUserId: "U04ABC123",
 *   role: "Senior Engineer",
 *   team: "Engineering",
 *   avatarUrl: "https://avatars.slack-edge.com/…/alice.jpg",
 *   connectedSources: ["slack", "github"],
 *   lastSeenAt: "10 min ago",
 * });
 *
 * // Minimal card (name only)
 * buildPersonCard({ displayName: "Bob Smith" });
 * ```
 */

import type { KnownBlock } from "./kit";
import { mrkdwn, imageElement, EMOJI } from "./kit";
import type { DataSource } from "@/types";

// ---------------------------------------------------------------------------
// Source badge helpers
// ---------------------------------------------------------------------------

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

export interface PersonCardInput {
  /** Full display name of the person. */
  displayName: string;

  /**
   * Slack member ID (e.g. "U04ABC123").
   * When provided, the name is rendered as a @-mention link.
   */
  slackUserId?: string;

  /**
   * Job title or role description.
   * e.g. "Senior Engineer", "Product Manager".
   */
  role?: string;

  /**
   * Team or department name.
   * e.g. "Engineering", "Design".
   */
  team?: string;

  /**
   * URL to the person's avatar image.
   * When provided, displayed as an image accessory on the section block.
   */
  avatarUrl?: string;

  /**
   * List of integrations this person is connected to.
   * Rendered as source emoji badges in the context row.
   */
  connectedSources?: DataSource[];

  /**
   * Human-readable relative timestamp of when this person was last seen.
   * e.g. "10 min ago", "Today at 09:30", "Yesterday".
   */
  lastSeenAt?: string;

  /**
   * Whether to link the display name to a Slack profile.
   * Only works when `slackUserId` is provided.
   * Defaults to `true`.
   */
  linkProfile?: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a person card as an array of Block Kit blocks.
 * Returns 1–2 blocks depending on whether a context row is needed.
 */
export function buildPersonCard(input: PersonCardInput): KnownBlock[] {
  const linkProfile = input.linkProfile ?? true;

  // ── Name / mention line ──────────────────────────────────────────────────
  const namePart =
    linkProfile && input.slackUserId
      ? `<@${input.slackUserId}>`
      : `*${input.displayName}*`;

  const roleTeamParts: string[] = [];
  if (input.role) roleTeamParts.push(input.role);
  if (input.team) roleTeamParts.push(input.team);
  const roleTeamLine = roleTeamParts.length > 0
    ? `\n${roleTeamParts.join("  ·  ")}`
    : "";

  const mainText = `${EMOJI.person} ${namePart}${roleTeamLine}`;

  // ── Image accessory ───────────────────────────────────────────────────────
  const accessory =
    input.avatarUrl
      ? imageElement(input.avatarUrl, input.displayName)
      : undefined;

  // ── Section block ─────────────────────────────────────────────────────────
  const sectionBlock: KnownBlock = {
    type: "section",
    text: mrkdwn(mainText),
    ...(accessory && { accessory }),
  };

  const blocks: KnownBlock[] = [sectionBlock];

  // ── Context row ───────────────────────────────────────────────────────────
  const contextParts: string[] = [];

  if (input.connectedSources && input.connectedSources.length > 0) {
    const sourceBadges = input.connectedSources
      .map((s) => SOURCE_EMOJI[s])
      .join(" ");
    contextParts.push(sourceBadges);
  }

  if (input.lastSeenAt) {
    contextParts.push(`${EMOJI.time} Last seen ${input.lastSeenAt}`);
  }

  if (contextParts.length > 0) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(contextParts.join("  ·  "))],
    });
  }

  return blocks;
}
