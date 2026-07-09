/**
 * @file slack/commands/index.ts
 * @description Barrel export for all Gravity slash command handlers.
 *
 * Register each command module here as it is implemented.
 * The parent bootstrap module (slack/bootstrap.ts) imports this file to
 * attach all commands to the Bolt App in one shot.
 *
 * ─── HOW TO ADD A COMMAND ─────────────────────────────────────────────────
 *
 *  1. Create `slack/commands/your-command.ts` and export a typed handler:
 *
 *     ```ts
 *     // slack/commands/your-command.ts
 *     import type { SlashCommand } from "@/slack/types";
 *
 *     export const yourCommandHandler: SlashCommand = async ({ command, ack, respond }) => {
 *       await ack();
 *       // TODO: implement
 *     };
 *     ```
 *
 *  2. Register it in this file:
 *
 *     ```ts
 *     export { yourCommandHandler } from "./your-command";
 *     ```
 *
 *  3. Wire it up in slack/bootstrap.ts:
 *
 *     ```ts
 *     slackApp.command("/your-command", yourCommandHandler);
 *     ```
 *
 * ──────────────────────────────────────────────────────────────────────────
 *
 * No handlers are registered yet — this file is intentionally empty.
 * It exists to establish the module boundary and guide future contributors.
 */

export { gravityCommandHandler } from "./gravity";
