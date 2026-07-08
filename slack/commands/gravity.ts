/**
 * @file slack/commands/gravity.ts
 * @description Slash command handler for `/gravity`.
 *
 * Receives slash command invocations, processes subcommands/queries, invokes
 * the intelligence orchestrator, and responds with formatted Block Kit blocks.
 */

import type { SlashCommandHandler } from "@/slack/types";
import { runOrchestrator } from "@/ai/engine";
import { getMockData } from "@/data/mock";
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
  logger.info(`Received /gravity command from user ${command.user_id} (${command.user_name}). Arguments: "${text}"`);

  try {
    // Get mock context and items relative to current date/time
    const { items, userContext } = getMockData(new Date());

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
