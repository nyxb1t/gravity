/**
 * @file slack/actions/quick-actions.ts
 * @description Block action handlers for Gravity Home Tab quick actions.
 */

import type { View } from "@slack/types";
import type { ActionArgs } from "@/slack/types";

type QuickActionHandler = (args: ActionArgs) => Promise<void>;

function getTriggerId(body: ActionArgs["body"]): string {
  if ("trigger_id" in body && typeof body.trigger_id === "string") {
    return body.trigger_id;
  }

  throw new Error("[quick-actions] Missing trigger_id for modal action.");
}

function buildQuickActionModal(title: string, text: string): View {
  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: title,
    },
    close: {
      type: "plain_text",
      text: "Close",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
      },
    ],
  };
}

async function openQuickActionModal(
  { body, client }: ActionArgs,
  title: string,
  text: string
): Promise<void> {
  await client.views.open({
    trigger_id: getTriggerId(body),
    view: buildQuickActionModal(title, text),
  });
}

export const onSummarizeDayAction: QuickActionHandler = async (args) => {
  await args.ack();
  await openQuickActionModal(
    args,
    "Today's Summary",
    "📋 *Today's Summary*\n• 3 tasks need attention\n• 1 meeting today\n• 2 alerts"
  );
};

export const onShowUnreadAction: QuickActionHandler = async (args) => {
  await args.ack();
  await openQuickActionModal(
    args,
    "Unread Messages",
    "💬 *Unread Messages*\n• 15 unread messages across your workspace\n• 3 in #engineering\n• 12 in org/gravity"
  );
};

export const onPendingPrsAction: QuickActionHandler = async (args) => {
  await args.ack();
  await openQuickActionModal(
    args,
    "Pending PRs",
    "🔎 *Pending PRs*\n• PR #42 needs your review\n• 3 PRs are waiting for attention\n• Auth timeout fix is marked critical"
  );
};

export const onCalendarAction: QuickActionHandler = async (args) => {
  await args.ack();
  await openQuickActionModal(
    args,
    "Calendar",
    "📅 *Calendar*\n• Team Sync at 5:00 PM\n• 3 attendees: Alice, Bob, Carol\n• No conflicts detected"
  );
};
