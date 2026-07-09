/**
 * @file slack/blocks/alert-card.ts
 * @description Alert card block builder.
 *
 * Renders a prominent, visually distinct notification card for system-level
 * alerts, conflict warnings, or time-sensitive messages. Unlike a priority
 * card (which represents a WorkspaceItem), an alert card is UI-generated —
 * it communicates a Gravity-level concern to the user.
 *
 * Alert types and their semantics:
 *  - `error`   → Something failed and requires the user's attention.
 *  - `warning` → A potential issue; user should review.
 *  - `info`    → Neutral informational message.
 *  - `success` → Positive outcome confirmation.
 *
 * Visual layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  ❌  *Auth expired*                                      │  ← section
 *   │  Your GitHub token is no longer valid. Reconnect now.   │
 *   │  [Reconnect GitHub]                                      │  ← actions (optional)
 *   └─────────────────────────────────────────────────────────┘
 *
 * @example
 * ```ts
 * import { buildAlertCard } from "@/slack/blocks/alert-card";
 *
 * // Error alert with an action button
 * buildAlertCard({
 *   type: "error",
 *   title: "GitHub token expired",
 *   message: "Your GitHub connection has expired. Reconnect to resume syncing.",
 *   action: { label: "Reconnect GitHub", actionId: "reconnect_github" },
 * });
 *
 * // Informational alert, no action
 * buildAlertCard({
 *   type: "info",
 *   title: "Scheduled maintenance",
 *   message: "Gravity will be briefly unavailable on Friday at 02:00 UTC.",
 * });
 * ```
 */

import type { KnownBlock } from "./kit";
import { mrkdwn, button, EMOJI } from "./kit";

// ---------------------------------------------------------------------------
// Alert type configuration
// ---------------------------------------------------------------------------

export type AlertType = "error" | "warning" | "info" | "success";

interface AlertConfig {
  emoji: string;
  prefix: string;
}

const ALERT_CONFIG: Record<AlertType, AlertConfig> = {
  error:   { emoji: EMOJI.error,   prefix: "Error"   },
  warning: { emoji: EMOJI.warning, prefix: "Warning" },
  info:    { emoji: EMOJI.info,    prefix: "Info"    },
  success: { emoji: EMOJI.success, prefix: "Success" },
};

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface AlertCardAction {
  /** Button label text. */
  label: string;

  /** Unique Bolt action_id for this button. */
  actionId: string;

  /**
   * Optional URL to open when the button is clicked.
   * Use for external links (e.g. OAuth reconnect flows).
   */
  url?: string;

  /**
   * Visual style of the button.
   * Defaults to `"primary"` for `error`/`warning`, `"default"` for others.
   */
  style?: "primary" | "danger" | "default";
}

export interface AlertCardInput {
  /** Severity of the alert. Drives the emoji prefix and visual treatment. */
  type: AlertType;

  /**
   * Short headline for the alert. Rendered in bold.
   * Keep under 80 characters.
   */
  title: string;

  /**
   * Full alert message. Supports mrkdwn.
   * Rendered as plain body text below the title.
   */
  message: string;

  /**
   * Optional single action button.
   * For alerts that require user action (e.g. "Reconnect", "Dismiss").
   */
  action?: AlertCardAction;

  /**
   * Optional footer context line rendered below the alert body.
   * Useful for "Last occurred at…" or "Affects N items" notes.
   */
  footer?: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds an alert card as an array of Block Kit blocks.
 * Returns 1–3 blocks depending on whether actions and a footer are provided.
 */
export function buildAlertCard(input: AlertCardInput): KnownBlock[] {
  const config = ALERT_CONFIG[input.type];
  const titleLine = `${config.emoji}  *${input.title}*`;
  const body = `${titleLine}\n${input.message}`;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: mrkdwn(body),
    },
  ];

  // Context footer
  if (input.footer) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(`_${input.footer}_`)],
    });
  }

  // Action button
  if (input.action) {
    const resolvedStyle = input.action.style ?? defaultStyle(input.type);
    blocks.push({
      type: "actions",
      elements: [
        button(input.action.label, input.action.actionId, {
          url:   input.action.url,
          style: resolvedStyle,
        }),
      ],
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Utilities (private)
// ---------------------------------------------------------------------------

function defaultStyle(type: AlertType): "primary" | "danger" | "default" {
  if (type === "error" || type === "warning") return "primary";
  if (type === "success") return "default";
  return "default";
}
