/**
 * @file slack/events/intent.ts
 * @description Lightweight intent classifier for Gravity DM messages.
 *
 * Classifies incoming user text into one of the supported intents so the
 * message handler can route to the right data fetch instead of dumping
 * the entire workspace context on every message.
 *
 * No LLM needed here — simple regex patterns handle 95% of queries.
 */

export type MessageIntent =
  | 'greeting'
  | 'tasks'
  | 'blockers'
  | 'meetings'
  | 'focus'
  | 'github'
  | 'notion'
  | 'unknown';

interface IntentRule {
  intent: MessageIntent;
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent:   'greeting',
    patterns: [
      /^(hi|hey|hello|howdy|sup|yo|good\s*(morning|evening|afternoon)|greetings?)[!?.]*$/i,
      /^(what'?s? up|hiya|heya)[!?.]*$/i,
    ],
  },
  {
    intent:   'meetings',
    patterns: [
      /meeting|calendar|event|schedule|call|standup|sync|interview/i,
      /what('?s)?\s+(on\s+)?my\s+(calendar|schedule)/i,
      /do\s+i\s+have\s+(any\s+)?(meeting|call|event)/i,
    ],
  },
  {
    intent:   'blockers',
    patterns: [
      /block(er|ed|ing)?|stuck|impede|obstacle|depend|waiting\s+on/i,
      /what('?s)?\s+block(ing|ed)/i,
      /any\s+block/i,
    ],
  },
  {
    intent:   'github',
    patterns: [
      /github|pull\s*request|pr|issue|review|commit|merge|branch/i,
      /(open|pending|assigned)\s+(pr|issue|ticket)/i,
    ],
  },
  {
    intent:   'notion',
    patterns: [
      /notion|doc(ument|s)?|page|spec|wiki|note|approval/i,
      /pending\s+(doc|page|approval)/i,
    ],
  },
  {
    intent:   'focus',
    patterns: [
      /focus|priorit(y|ies|ize)|today|should\s+i\s+(work|do|start)|most\s+important/i,
      /what\s+(should|do)\s+i/i,
      /digest|summary|overview|wrap.?up/i,
    ],
  },
  {
    intent:   'tasks',
    patterns: [
      /task|todo|to-?do|work item|assign(ed|ment)?|my\s+(task|work|item)/i,
      /what('?s)?\s+(my|the)\s+task/i,
      /(any|open|pending)\s+(task|work|item)/i,
    ],
  },
];

/**
 * Classifies the intent of a user's DM message.
 *
 * @param text - Raw message text (already trimmed, no @mentions).
 * @returns The closest matching `MessageIntent`, or `'unknown'` if no rule fires.
 */
export function classifyIntent(text: string): MessageIntent {
  const clean = text.trim().toLowerCase();

  // Short messages (≤ 3 chars) with no match → treat as unknown, not greeting
  if (clean.length === 0) return 'unknown';

  for (const { intent, patterns } of INTENT_RULES) {
    if (patterns.some((p) => p.test(clean))) {
      return intent;
    }
  }

  return 'unknown';
}
