/**
 * @file slack/types.ts
 * @description Slack-specific TypeScript types for the Gravity experience layer.
 *
 * These types are intentionally thin wrappers and re-exports of Bolt's own
 * generics. They exist so that:
 *  - Handler signatures across the codebase are uniform.
 *  - Future breaking changes in @slack/bolt are contained to this one file.
 *  - Contributors do not need to import directly from @slack/bolt internals.
 *
 * Types that belong to the shared intelligence layer (WorkspaceItem, etc.)
 * remain in `types/index.ts` — do NOT duplicate them here.
 */

import type {
  SlashCommand as BoltSlashCommand,
  SlackEventMiddlewareArgs,
  SlackActionMiddlewareArgs,
  SlackViewMiddlewareArgs,
  AllMiddlewareArgs,
  AckFn,
  RespondFn,
  App,
} from "@slack/bolt";

// ---------------------------------------------------------------------------
// Re-exports from Bolt for convenience
// ---------------------------------------------------------------------------

export type { App };

// ---------------------------------------------------------------------------
// Slash command handler
// ---------------------------------------------------------------------------

/**
 * Type alias for a fully-typed Slack slash command handler.
 *
 * Usage:
 * ```ts
 * import type { SlashCommandHandler } from "@/slack/types";
 *
 * export const myHandler: SlashCommandHandler = async ({ command, ack, respond }) => {
 *   await ack();
 *   await respond("Hello from Gravity!");
 * };
 * ```
 */
export type SlashCommandHandler = (args: {
  command: BoltSlashCommand;
  ack: AckFn<void>;
  respond: RespondFn;
} & AllMiddlewareArgs) => Promise<void>;

// ---------------------------------------------------------------------------
// Event middleware args shorthand
// ---------------------------------------------------------------------------

/**
 * Shorthand for Bolt's `SlackEventMiddlewareArgs` generic.
 *
 * Usage:
 * ```ts
 * import type { EventArgs } from "@/slack/types";
 * export async function onAppMention(args: EventArgs<"app_mention">) { ... }
 * ```
 */
export type EventArgs<T extends string> = SlackEventMiddlewareArgs<T> &
  AllMiddlewareArgs;

// ---------------------------------------------------------------------------
// Action middleware args shorthand
// ---------------------------------------------------------------------------

/**
 * Shorthand for Bolt's `SlackActionMiddlewareArgs` generic.
 *
 * Usage:
 * ```ts
 * import type { ActionArgs } from "@/slack/types";
 * export async function onButtonClick(args: ActionArgs) { ... }
 * ```
 */
export type ActionArgs = SlackActionMiddlewareArgs & AllMiddlewareArgs;

// ---------------------------------------------------------------------------
// View (modal) middleware args shorthand
// ---------------------------------------------------------------------------

/**
 * Shorthand for Bolt's `SlackViewMiddlewareArgs` for view_submission callbacks.
 *
 * Usage:
 * ```ts
 * import type { ViewSubmissionArgs } from "@/slack/types";
 * export async function onModalSubmit(args: ViewSubmissionArgs) { ... }
 * ```
 */
export type ViewSubmissionArgs = SlackViewMiddlewareArgs & AllMiddlewareArgs;

/**
 * Shorthand for Bolt's `SlackViewMiddlewareArgs` for view_closed callbacks.
 *
 * Usage:
 * ```ts
 * import type { ViewClosedArgs } from "@/slack/types";
 * export async function onModalClosed(args: ViewClosedArgs) { ... }
 * ```
 */
export type ViewClosedArgs = SlackViewMiddlewareArgs & AllMiddlewareArgs;

// ---------------------------------------------------------------------------
// Gravity-specific context extension
// ---------------------------------------------------------------------------

/**
 * Extra properties that Gravity middleware will attach to Bolt's context
 * object (`context`) for downstream handlers.
 *
 * Extend this interface as new middleware layers are added.
 */
export interface GravitySlackContext {
  /**
   * Gravity's internal user ID derived from the Slack user ID.
   * Populated by auth middleware once user lookup is implemented.
   */
  gravityUserId?: string;

  /**
   * Whether the requesting Slack user has completed Gravity onboarding.
   * Used to gate feature access in commands and events.
   */
  isOnboarded?: boolean;
}
