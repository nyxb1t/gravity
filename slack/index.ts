/**
 * @file slack/index.ts
 * @description Public entry point for the Slack experience layer.
 *
 * Import everything Slack-related from this single barrel file to keep
 * consumer imports clean and stable across refactors.
 *
 * @example
 * ```ts
 * import { slackApp, slackConfig } from "@/slack";
 * ```
 */

export { slackApp, default } from "@/slack/app";
export { slackConfig } from "@/slack/config";
export type { SlackConfig } from "@/slack/config";
