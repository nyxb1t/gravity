/**
 * @file slack/events/app-mention.ts
 * @description Event handler for Slack's `app_mention` event.
 *
 * Triggered when a user mentions @Gravity in a channel or thread.
 * Parses the query, invokes the intelligence orchestrator, and replies back
 * in the same thread/channel with formatted priorities or search results.
 */

import type { EventArgs } from "@/slack/types";
import { runOrchestrator } from "@/ai/engine";
import { getMockData } from "@/data/mock";
import { formatPrioritiesBlocks, formatSearchBlocks } from "@/slack/utils";

/**
 * Handles the app_mention event.
 */
export async function onAppMention({
  event,
  client,
  context,
  logger,
}: EventArgs<"app_mention">): Promise<void> {
  const rawText = event.text || "";
  // Strip the bot mention e.g. <@U024BE91L> from the text
  const cleanQuery = rawText.replace(/<@[A-Z0-9]+>/gi, "").trim();

  logger.info(`Received @Gravity mention from user ${event.user}. Query: "${cleanQuery}"`);

  // Acknowledge/reply in the same thread/channel.
  // Bolt does not have an ack() function for events, but we thread the response.
  const thread_ts = event.thread_ts ?? event.ts;

  try {
    // Get mock context and items relative to current date/time
    const { items, userContext } = getMockData(new Date());

    // Determine the orchestration mode based on the user query
    const isPriorityQuery = !cleanQuery || /priorit|focus|today|digest/i.test(cleanQuery);
    const mode = isPriorityQuery ? "lens" : "search";

    logger.info(`Running orchestrator in mode: ${mode}`);

    const orchestratorResult = await runOrchestrator({
      items,
      context: userContext,
      mode,
      searchQuery: isPriorityQuery ? undefined : cleanQuery,
      options: {
        debug: true,
      },
    });

    let blocks;
    if (mode === "lens") {
      blocks = formatPrioritiesBlocks(orchestratorResult.rankedItems);
    } else {
      blocks = formatSearchBlocks(cleanQuery, orchestratorResult.rankedItems);
    }

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts,
      text: mode === "lens" ? "Here are your priorities:" : `Search results for "${cleanQuery}":`,
      blocks,
    });
  } catch (error) {
    logger.error("Failed to process app mention:", error);

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts,
      text: `⚠️ Sorry, I encountered an error while processing your request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
