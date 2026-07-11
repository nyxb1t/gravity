/**
 * @file slack/utils.ts
 * @description Formatting utilities for mapping Gravity Orchestrator results to Slack Block Kit.
 */

import type { RankedItem } from "@/ai/ranking";
import type { DetectedConflict } from "@/ai/conflicts";
import type { KnownBlock } from "@/slack/blocks";
import {
  buildPriorityCard,
  buildAlertCard,
  buildSectionBlock,
  buildDividerBlock,
} from "@/slack/blocks";

/**
 * Formats an ISO timestamp to a relative time string (e.g. "5 min ago", "2 hr ago").
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (60 * 1000));

    if (isNaN(diffMins)) return "recently";
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} days ago`;
  } catch {
    return "recently";
  }
}

/**
 * Formats ranked items (Lens/Priority mode) into Block Kit blocks.
 */
export function formatPrioritiesBlocks(rankedItems: RankedItem[]): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  blocks.push(...buildSectionBlock({
    text: "✨ *Your Gravity Workspace Priorities*"
  }));

  if (rankedItems.length === 0) {
    blocks.push(...buildSectionBlock({
      text: "You are all caught up! No priorities found."
    }));
    return blocks;
  }

  // Show top 3 priorities in chat to avoid flooding the channel
  const topItems = rankedItems.slice(0, 3);
  for (let index = 0; index < topItems.length; index++) {
    const ranked = topItems[index];
    const card = buildPriorityCard({
      id: ranked.item.raw.id,
      title: ranked.item.raw.title,
      url: ranked.item.raw.url,
      body: ranked.item.raw.body,
      source: ranked.item.raw.source,
      urgency: ranked.score.urgency,
      author: ranked.item.raw.author?.displayName,
      channel: ranked.item.raw.channel,
      timestamp: ranked.item.raw.createdAt ? formatRelativeTime(ranked.item.raw.createdAt) : undefined,
      showActions: true,
    });
    blocks.push(...card);
    if (index < topItems.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  if (rankedItems.length > 3) {
    blocks.push(...buildDividerBlock());
    blocks.push(...buildSectionBlock({
      text: `*...and ${rankedItems.length - 3} more items.* View them all on the *Gravity Home Tab*.`
    }));
  } else {
    blocks.push(...buildDividerBlock());
    blocks.push(...buildSectionBlock({
      text: "💡 *Tip:* View your full digest with all active channels and collaborators on the *Gravity Home Tab*."
    }));
  }

  return blocks;
}

/**
 * Formats search results into Block Kit blocks.
 */
export function formatSearchBlocks(query: string, rankedItems: RankedItem[]): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  blocks.push(...buildSectionBlock({
    text: `🔍 *Gravity Search Results for:* "${query}"`
  }));

  if (rankedItems.length === 0) {
    blocks.push(...buildSectionBlock({
      text: "No matching items found in your workspace."
    }));
    return blocks;
  }

  // Show top 3 results in chat
  const topItems = rankedItems.slice(0, 3);
  for (let index = 0; index < topItems.length; index++) {
    const ranked = topItems[index];
    const card = buildPriorityCard({
      id: ranked.item.raw.id,
      title: ranked.item.raw.title,
      url: ranked.item.raw.url,
      body: ranked.item.raw.body,
      source: ranked.item.raw.source,
      urgency: ranked.score.urgency,
      author: ranked.item.raw.author?.displayName,
      channel: ranked.item.raw.channel,
      timestamp: ranked.item.raw.createdAt ? formatRelativeTime(ranked.item.raw.createdAt) : undefined,
      showActions: true,
    });
    blocks.push(...card);
    if (index < topItems.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  if (rankedItems.length > 3) {
    blocks.push(...buildDividerBlock());
    blocks.push(...buildSectionBlock({
      text: `*...and ${rankedItems.length - 3} more search results.*`
    }));
  }

  return blocks;
}

/**
 * Formats conflicts into Block Kit blocks using AlertCard components.
 */
export function formatConflictsBlocks(conflicts: DetectedConflict[]): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  blocks.push(...buildSectionBlock({
    text: "⚠️ *Gravity Workspace Conflicts Detected*"
  }));

  if (conflicts.length === 0) {
    blocks.push(...buildSectionBlock({
      text: "Nice job! No conflicts detected in your workspace right now."
    }));
    return blocks;
  }

  // Show top 3 conflicts in chat
  const topConflicts = conflicts.slice(0, 3);
  for (let index = 0; index < topConflicts.length; index++) {
    const conflict = topConflicts[index];
    // Map severity to AlertType
    let alertType: "error" | "warning" | "info" = "info";
    if (conflict.severity === "critical") alertType = "error";
    else if (conflict.severity === "high") alertType = "warning";

    // Map first suggested action if available
    const primaryAction = conflict.suggestedActions?.[0];
    const alertAction = primaryAction
      ? {
          label: primaryAction.label,
          actionId: `resolve_conflict__${conflict.id}`,
          url: primaryAction.actionUrl,
        }
      : undefined;

    const alertCard = buildAlertCard({
      type: alertType,
      title: `${conflict.severity.toUpperCase()}: ${conflict.description}`,
      message: conflict.explanation,
      action: alertAction,
      footer: conflict.detectedAt ? `Detected ${formatRelativeTime(conflict.detectedAt)}` : undefined,
    });

    blocks.push(...alertCard);

    if (index < topConflicts.length - 1) {
      blocks.push(...buildDividerBlock());
    }
  }

  if (conflicts.length > 3) {
    blocks.push(...buildDividerBlock());
    blocks.push(...buildSectionBlock({
      text: `*...and ${conflicts.length - 3} more conflicts.* Open the *Gravity Home Tab* to see them.`
    }));
  }

  return blocks;
}
