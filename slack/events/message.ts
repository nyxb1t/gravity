/**
 * @file slack/events/message.ts
 * @description Event handler for Slack's `message` event.
 *
 * Handles messages sent directly to the bot in its "Messages" tab (DMs).
 * Ignores messages in channels (handled by app_mention) and bot messages.
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
 * Handles the message event.
 */
export async function onMessage({
  event,
  client,
  logger,
}: EventArgs<"message">): Promise<void> {
  const messageEvent = event as any;

  // 1. Ignore message sub-types (like thread_broadcast) that don't have text,
  // and ignore all bot messages to prevent infinite loops.
  if (messageEvent.bot_id || messageEvent.subtype) return;

  // 2. Only handle 1-on-1 Direct Messages (IMs) in the Messages tab.
  // Channel messages must use @Gravity mention (handled by app_mention).
  const isIM = messageEvent.channel_type === "im" || (messageEvent.channel && messageEvent.channel.startsWith("D"));
  if (!isIM) return;

  const cleanQuery = (messageEvent.text || "").trim();
  const useLive = process.env.USE_LIVE_DATA === "true";
  logger.info(`Received DM in Messages tab. Query: "${cleanQuery}". Live data: ${useLive}`);

  const thread_ts = messageEvent.thread_ts ?? messageEvent.ts;

  try {
    // Fetch workspace items (live or mock based on USE_LIVE_DATA)
    const { items, userContext } = await getWorkspaceData();

    // Determine the orchestration mode based on the query
    const isPriorityQuery = !cleanQuery || /priorit|focus|today|digest/i.test(cleanQuery);
    const mode = isPriorityQuery ? "lens" : "search";

    logger.info(`Running orchestrator for DM in mode: ${mode}`);

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
      channel: messageEvent.channel,
      thread_ts,
      text: mode === "lens" ? "Here are your priorities:" : `Search results for "${cleanQuery}":`,
      blocks,
    });
  } catch (error) {
    logger.error("Failed to process direct message:", error);

    await client.chat.postMessage({
      channel: messageEvent.channel,
      thread_ts,
      text: `⚠️ Sorry, I encountered an error while processing your message: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
