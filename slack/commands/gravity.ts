/**
 * @file slack/commands/gravity.ts
 * @description Slash command handler for `/gravity`.
 *
 * Receives slash command invocations, processes subcommands/queries, invokes
 * the intelligence orchestrator, and responds with formatted Block Kit blocks.
 *
 * Data source is controlled by the USE_LIVE_DATA environment variable:
 *  - USE_LIVE_DATA=true  → real data from GitHub, Google Calendar, and Notion
 *  - USE_LIVE_DATA=false → mock data (default, safe for development/CI)
 */

import type { SlashCommandHandler } from "@/slack/types";
import { runOrchestrator } from "@/ai/engine";
import { getWorkspaceData } from "@/integrations/live";
import {
  formatPrioritiesBlocks,
  formatSearchBlocks,
  formatConflictsBlocks,
} from "@/slack/utils";

/**
 * Handles the /gravity slash command.
 */
export const gravityCommandHandler: SlashCommandHandler = async ({
  command,
  ack,
  respond,
  logger,
}) => {
  // 1. Acknowledge the command immediately (Slack expects a response within 3s)
  await ack();

  const text = (command.text || "").trim();
  const useLive = process.env.USE_LIVE_DATA === "true";
  logger.info(`Received /gravity command from user ${command.user_id} (${command.user_name}). Arguments: "${text}". Live data: ${useLive}`);

  try {
    // Fetch workspace items (live or mock based on USE_LIVE_DATA)
    const { items, userContext } = await getWorkspaceData();

    let mode: "lens" | "search" | "conflicts" = "lens";
    let searchQuery = "";

    // Parse subcommands
    if (text.toLowerCase() === "conflicts") {
      mode = "conflicts";
    } else if (text.toLowerCase().startsWith("search ")) {
      mode = "search";
      searchQuery = text.slice(7).trim();
    } else if (text) {
      // If there is any other text, treat it as a search query
      mode = "search";
      searchQuery = text;
    }

    logger.info(`Invoking orchestrator in mode: ${mode} with query: "${searchQuery}"`);

    const orchestratorResult = await runOrchestrator({
      items,
      context: userContext,
      mode,
      searchQuery: mode === "search" ? searchQuery : undefined,
      options: {
        debug: true,
      },
    });

    let blocks;
    if (mode === "lens") {
      blocks = formatPrioritiesBlocks(orchestratorResult.rankedItems);
    } else if (mode === "search") {
      blocks = formatSearchBlocks(searchQuery, orchestratorResult.rankedItems);
    } else {
      blocks = formatConflictsBlocks(orchestratorResult.conflictResult.conflicts);
    }

    // Respond back to the user (defaults to ephemeral)
    await respond({
      blocks,
      response_type: "ephemeral",
    });
  } catch (error) {
    logger.error("Failed to process /gravity command:", error);

    await respond({
      text: `⚠️ Sorry, I encountered an error while processing the command: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      response_type: "ephemeral",
    });
  }
};
