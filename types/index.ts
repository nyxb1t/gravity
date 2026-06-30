/**
 * @file types/index.ts
 * @description Shared TypeScript models for Gravity's intelligence layer.
 *
 * These interfaces are intentionally source-agnostic — they work uniformly
 * across Slack, GitHub, Notion, Calendar, and any future integration.
 *
 * No business logic lives here. This file is the single source of truth
 * for the data contracts that flow through the entire Gravity system.
 */

// ---------------------------------------------------------------------------
// Primitive Enumerations
// ---------------------------------------------------------------------------

/** Every integration Gravity can ingest data from. */
export type DataSource = "slack" | "github" | "notion" | "calendar" | "email";

/**
 * Coarse urgency band assigned to any item before deeper scoring.
 * - critical  → must act now (e.g. prod incident, calendar conflict)
 * - high      → should act today
 * - medium    → worth reviewing this week
 * - low       → informational / can be deferred
 * - dismissed → user has explicitly marked as unimportant
 */
export type UrgencyBand = "critical" | "high" | "medium" | "low" | "dismissed";

/** Broad category that describes what kind of thing an item represents. */
export type ItemKind =
  | "message"       // Slack DM, channel post, thread reply
  | "mention"       // @-mention anywhere
  | "pr_review"     // Pull-request review request / comment
  | "issue"         // Bug report, task, ticket
  | "commit"        // Code commit
  | "page_edit"     // Notion page created or updated
  | "comment"       // Inline comment on a doc or code
  | "event"         // Calendar meeting or deadline
  | "notification"; // Generic catch-all notification

// ---------------------------------------------------------------------------
// UserContext
// ---------------------------------------------------------------------------

/**
 * Everything Gravity knows about the current user at request time.
 *
 * This is passed into every scoring and filtering operation so that
 * prioritisation can be personalised without a separate lookup.
 */
export interface UserContext {
  /** Stable, globally unique identifier for this user. */
  userId: string;

  /** Human-readable display name (for logging / debugging). */
  displayName: string;

  /** Primary email address — used to match calendar invites, GitHub commits, etc. */
  email: string;

  /** ISO 639-1 locale code, e.g. "en", "de". Used for NLP hinting. */
  locale: string;

  /** IANA timezone string, e.g. "Asia/Kolkata". */
  timezone: string;

  /**
   * Connected integration accounts.
   * Key  → DataSource identifier.
   * Value → opaque provider user ID (Slack member ID, GitHub login, etc.).
   */
  connectedAccounts: Partial<Record<DataSource, string>>;

  /**
   * Roles or team memberships that affect relevance scoring.
   * e.g. ["engineering", "on-call", "team-lead"]
   */
  roles: string[];

  /**
   * User-configured quiet hours (local time, 24-hour clock).
   * Items arriving during this window receive a score penalty.
   */
  quietHours?: {
    start: string; // "HH:MM"
    end: string;   // "HH:MM"
  };

  /**
   * Channels, repos, or pages the user has pinned as high-priority.
   * Items from these sources receive a scoring boost.
   */
  prioritySources: string[];

  /**
   * Sources the user has muted. Items from these are suppressed unless
   * they contain a direct @mention of the user.
   */
  mutedSources: string[];
}

// ---------------------------------------------------------------------------
// WorkspaceItem
// ---------------------------------------------------------------------------

/**
 * A single unit of information retrieved from any connected integration.
 *
 * WorkspaceItem is the canonical input type for Gravity's intelligence
 * pipeline. Every integration adapter must produce this shape.
 */
export interface WorkspaceItem {
  /**
   * Globally unique identifier, namespaced by source.
   * Recommended format: `{source}:{provider-native-id}`
   * e.g. "slack:C01234567:1718000000.000100"
   */
  id: string;

  /** Where this item originated. */
  source: DataSource;

  /** Semantic classification of what this item represents. */
  kind: ItemKind;

  /** Human-readable headline for the item (Slack: first 120 chars; GitHub: PR title). */
  title: string;

  /**
   * Full plain-text body of the item, sanitised and stripped of markup.
   * May be empty for items like calendar events with no description.
   */
  body: string;

  /** ISO 8601 UTC timestamp when the item was originally created/sent. */
  createdAt: string;

  /** ISO 8601 UTC timestamp of the most recent modification, if applicable. */
  updatedAt?: string;

  /** Provider-native URL that opens this item in the source application. */
  url: string;

  /**
   * The user or system that created this item.
   * `null` represents an automated/bot actor.
   */
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  } | null;

  /**
   * Other users explicitly involved in this item (participants, assignees,
   * reviewers, attendees, etc.).
   */
  participants: Array<{
    id: string;
    displayName: string;
    role?: string; // e.g. "assignee", "reviewer", "attendee"
  }>;

  /**
   * Whether this item explicitly @-mentions the current user.
   * Populated by the integration adapter, not inferred.
   */
  mentionsUser: boolean;

  /**
   * Logical grouping within the source system.
   * Slack → channel name, GitHub → repo slug, Notion → workspace/page path.
   */
  channel?: string;

  /**
   * Free-form labels or tags attached by the source system.
   * e.g. GitHub labels, Notion tags, Slack emoji reactions.
   */
  tags: string[];

  /**
   * Arbitrary source-specific metadata that doesn't fit the schema above.
   * Adapters may store provider-native fields here for downstream use.
   */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SearchQuery
// ---------------------------------------------------------------------------

/**
 * Structured query that the intelligence layer resolves against the
 * item index. Supports both free-text and faceted filtering.
 *
 * All fields are optional — an empty query returns all items ordered
 * by their PriorityScore.
 */
export interface SearchQuery {
  /** Full-text search string. Applied against `title` and `body`. */
  text?: string;

  /** Restrict results to specific sources. */
  sources?: DataSource[];

  /** Restrict results to specific item kinds. */
  kinds?: ItemKind[];

  /** Only return items at or above this urgency level. */
  minUrgency?: UrgencyBand;

  /** ISO 8601 UTC lower bound for `createdAt`. */
  after?: string;

  /** ISO 8601 UTC upper bound for `createdAt`. */
  before?: string;

  /**
   * Only return items from these logical channels / repos / pages.
   * Matched against `WorkspaceItem.channel`.
   */
  channels?: string[];

  /** Only return items that mention the requesting user. */
  mentionsUserOnly?: boolean;

  /** Filter by tag(s). Items must have at least one of the supplied tags. */
  tags?: string[];

  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;

  /** Zero-based offset for pagination. Defaults to 0. */
  offset?: number;

  /**
   * Field to sort by. Defaults to "score" (descending by PriorityScore).
   * "recency" sorts by `createdAt` descending.
   */
  sortBy?: "score" | "recency";
}

// ---------------------------------------------------------------------------
// SearchResult
// ---------------------------------------------------------------------------

/**
 * A single item returned by a search, enriched with scoring information
 * so the UI can explain why each result was surfaced.
 */
export interface SearchResult {
  /** The underlying workspace item. */
  item: WorkspaceItem;

  /** The computed priority score for this item in this query context. */
  score: PriorityScore;

  /**
   * Short human-readable tokens explaining the score.
   * e.g. ["direct mention", "active thread", "from muted channel (-0.3)"]
   * Populated by the scoring engine for transparency / debugging.
   */
  scoreReasons: string[];

  /**
   * True if this result was boosted by user-configured priority sources.
   * False otherwise.
   */
  isPinned: boolean;

  /**
   * True if this result would normally have been suppressed (e.g. muted
   * source) but was surfaced because it contains a direct @mention.
   */
  surfacedDespiteMute: boolean;
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

/**
 * A detected conflict between two or more WorkspaceItems.
 *
 * Conflicts are identified by the intelligence layer before any response
 * is generated. They represent situations where a user's attention is
 * being pulled in incompatible directions at the same time.
 *
 * Examples:
 *  - Two calendar events overlapping at the same time
 *  - A PR review request during a user's declared out-of-office
 *  - Simultaneous urgent pings in multiple channels
 */
export interface Conflict {
  /** Stable ID for this conflict instance. */
  id: string;

  /**
   * Classification of the conflict type.
   * - schedule   → time-based overlap (calendar, deadlines)
   * - attention  → multiple high-urgency items competing simultaneously
   * - dependency → item A is blocked by item B
   * - duplicate  → two items represent the same real-world event
   */
  type: "schedule" | "attention" | "dependency" | "duplicate";

  /** The items involved in the conflict (minimum 2). */
  items: WorkspaceItem[];

  /**
   * Human-readable description of the conflict.
   * Written to be shown directly to the user if surface is requested.
   */
  description: string;

  /**
   * Severity of the conflict, aligned to UrgencyBand semantics.
   * Used to decide whether to interrupt the user immediately.
   */
  severity: UrgencyBand;

  /** ISO 8601 UTC timestamp when this conflict was detected. */
  detectedAt: string;

  /**
   * Whether the user has acknowledged this conflict.
   * Acknowledged conflicts are not re-surfaced unless the state changes.
   */
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// PriorityScore
// ---------------------------------------------------------------------------

/**
 * Multi-dimensional score that Gravity assigns to a WorkspaceItem
 * for a specific UserContext.
 *
 * Keeping individual dimensions separate (rather than collapsing to a
 * single float) allows the UI to surface transparent, actionable reasons
 * and allows the scoring model to be tuned per-dimension independently.
 */
export interface PriorityScore {
  /**
   * Final aggregated score in [0, 1].
   * Higher → more deserving of the user's immediate attention.
   */
  total: number;

  /**
   * Coarse urgency band derived from `total`.
   * Used for bucketing in the UI and for filtering via SearchQuery.minUrgency.
   */
  urgency: UrgencyBand;

  /**
   * Individual scoring dimensions in [0, 1].
   * All dimensions are normalised to the same scale so they can be
   * weighted and summed consistently.
   */
  dimensions: {
    /**
     * Relevance of the item's content to the user's current work context.
     * Based on projects, repos, and channels the user is actively involved in.
     */
    relevance: number;

    /**
     * How urgent the item is in absolute terms.
     * Driven by keywords, labels (e.g. "P0", "urgent"), and item kind.
     */
    urgencySignal: number;

    /**
     * How recently the item was created or updated.
     * Decays over time according to a configurable half-life.
     */
    recency: number;

    /**
     * Whether the user was directly addressed (mention, assignee, invitee).
     * Binary signal: 1.0 if true, 0.0 if false.
     */
    directAddressing: number;

    /**
     * Activity level in the thread or context this item belongs to.
     * High engagement from others suggests it matters.
     */
    threadEngagement: number;

    /**
     * Relationship weight of the author — closer collaborators score higher.
     * Derived from historical interaction frequency.
     */
    authorProximity: number;
  };

  /**
   * Penalty multiplier applied when the item arrived during quiet hours.
   * Value in [0, 1] — 1.0 means no penalty, 0.0 means fully suppressed.
   */
  quietHoursPenalty: number;

  /**
   * Boost multiplier applied when the item's source is in prioritySources.
   * Value >= 1.0.
   */
  prioritySourceBoost: number;

  /** ISO 8601 UTC timestamp when this score was computed. */
  scoredAt: string;

  /**
   * Version of the scoring algorithm that produced this score.
   * Used to invalidate stale scores after model updates.
   * Format: semver string, e.g. "1.0.0".
   */
  modelVersion: string;
}

// ---------------------------------------------------------------------------
// NormalizedItem
// ---------------------------------------------------------------------------

/**
 * The unified, normalised representation of any WorkspaceItem after it
 * has passed through the intelligence pipeline.
 *
 * NormalizedItem is the output type that the Gravity API and UI consume.
 * It combines the raw item, its priority score, and any conflicts detected
 * in a single, self-contained object.
 */
export interface NormalizedItem {
  /** The raw workspace item as ingested from the source. */
  raw: WorkspaceItem;

  /**
   * The priority score computed for the current user context.
   * Undefined if the item has not yet been scored.
   */
  score?: PriorityScore;

  /**
   * Any conflicts that involve this item.
   * Empty array if no conflicts were detected.
   */
  conflicts: Conflict[];

  /**
   * True when the item has been seen/opened by the user in any Gravity surface.
   * Read items still appear in results but receive a visual distinction.
   */
  isRead: boolean;

  /**
   * True when the user has bookmarked this item for later review.
   * Bookmarked items are preserved even after they would normally age out.
   */
  isBookmarked: boolean;

  /**
   * ISO 8601 UTC timestamp when the user first viewed this item via Gravity.
   * Null if unseen.
   */
  firstSeenAt: string | null;

  /**
   * Optional user annotation stored against this item.
   * e.g. a quick note attached to a PR review request.
   */
  userNote?: string;

  /**
   * ISO 8601 UTC timestamp when this normalised item was last updated
   * by the pipeline (re-scored, conflict status changed, etc.).
   */
  lastProcessedAt: string;
}

// ---------------------------------------------------------------------------
// GravityResponse
// ---------------------------------------------------------------------------

/**
 * Top-level response envelope returned by the Gravity intelligence API.
 *
 * Every API response is wrapped in this type so clients have a consistent
 * contract regardless of what they asked for.
 */
export interface GravityResponse<T = unknown> {
  /** Whether the request completed successfully. */
  ok: boolean;

  /**
   * The response payload. Present when `ok` is true.
   * Type parameter `T` is inferred from the calling context.
   */
  data?: T;

  /**
   * Structured error information. Present when `ok` is false.
   */
  error?: {
    /**
     * Machine-readable error code.
     * e.g. "RATE_LIMITED", "PERMISSION_DENIED", "ITEM_NOT_FOUND"
     */
    code: string;

    /** Human-readable error message safe to display in developer tools. */
    message: string;

    /**
     * Additional diagnostic details — never shown to end users.
     * May contain stack traces, upstream API errors, etc.
     */
    details?: Record<string, unknown>;
  };

  /**
   * Pagination cursor for the next page of results.
   * Undefined when there are no further pages or pagination is not applicable.
   */
  nextCursor?: string;

  /** Total count of items matching the query, before pagination. */
  totalCount?: number;

  /**
   * Conflicts detected during this request, if any.
   * Surfaced at the response level so the client can act on them
   * independently of the primary `data` payload.
   */
  conflicts?: Conflict[];

  /**
   * Pipeline performance metadata — omitted in production by default,
   * included when `?debug=true` is passed.
   */
  meta?: {
    /** Wall-clock duration of the full request in milliseconds. */
    durationMs: number;

    /** Number of items evaluated before filtering and scoring. */
    itemsEvaluated: number;

    /** Number of items returned after all filters were applied. */
    itemsReturned: number;

    /** Version of the scoring model used during this request. */
    modelVersion: string;

    /** ISO 8601 UTC timestamp of the request. */
    requestedAt: string;
  };
}
