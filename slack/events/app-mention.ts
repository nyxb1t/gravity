/**
 * @file slack/events/app-mention.ts
 * @description Event handler for Slack's `app_mention` event.
 *
 * Triggered when a user mentions @Gravity in a channel or thread.
 * Parses the query, invokes the intelligence orchestrator, and replies back
 * in the same thread/channel with formatted priorities or search results.
 *
 * Data source is controlled by the USE_LIVE_DATA environment variable:
 *  - USE_LIVE_DATA=true  → real data from GitHub, Google Calendar, and Notion
 *  - USE_LIVE_DATA=false → mock data (default, safe for development/CI)
 */

import type { EventArgs } from "@/slack/types";
import { runOrchestrator } from "@/ai/engine";
import { getWorkspaceData } from "@/integrations/live";
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

  const useLive = process.env.USE_LIVE_DATA === "true";
  logger.info(`Received @Gravity mention from user ${event.user}. Query: "${cleanQuery}". Live data: ${useLive}`);

  // Acknowledge/reply in the same thread/channel.
  // Bolt does not have an ack() function for events, but we thread the response.
  const thread_ts = event.thread_ts ?? event.ts;

  try {
    // Fetch workspace items (live or mock based on USE_LIVE_DATA)
    const { items, userContext } = await getWorkspaceData();

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
