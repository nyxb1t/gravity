/**
 * @file slack/config.ts
 * @description Validated Slack configuration resolved from environment variables.
 *
 * All Slack-related environment variables are read exactly once here and
 * exported as a frozen, type-safe config object. Import this module anywhere
 * a Slack credential is needed instead of reading `process.env` directly.
 *
 * Required env vars (set in .env.local for development):
 *   SLACK_BOT_TOKEN      – xoxb-… Bot User OAuth Token
 *   SLACK_SIGNING_SECRET – Used to verify incoming request signatures
 *   SLACK_APP_TOKEN      – xapp-… App-Level Token (Socket Mode)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the resolved Slack configuration. */
export interface SlackConfig {
  /** Bot User OAuth Token (xoxb-…). */
  readonly botToken: string;

  /** Signing secret used to verify Slack's request signatures. */
  readonly signingSecret: string;

  /**
   * App-Level Token (xapp-…) required for Socket Mode.
   * Socket Mode lets the app receive events without a public HTTP endpoint.
   */
  readonly appToken: string;

  /**
   * Whether Socket Mode is enabled.
   * Derived automatically: true when `appToken` is present and non-empty.
   */
  readonly socketMode: boolean;

  /**
   * Port the Slack receiver listens on in HTTP mode.
   * Ignored when `socketMode` is true. Defaults to 3001 to avoid
   * conflicting with the Next.js dev server on 3000.
   */
  readonly port: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Reads a required environment variable and throws a descriptive error if
 * it is missing or empty, so failures are caught at startup time rather than
 * deep in a request handler.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[Gravity/Slack] Missing required environment variable: ${key}\n` +
        `  → Add it to your .env.local file and restart the server.`
    );
  }
  return value.trim();
}

/**
 * Reads an optional environment variable. Returns `undefined` if the variable
 * is absent or empty.
 */
function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

/**
 * Builds and validates the Slack configuration from the current environment.
 * Throws immediately with a human-readable message if any required variable
 * is absent — this prevents the app from starting in a broken state.
 */
function buildSlackConfig(): SlackConfig {
  const botToken = requireEnv("SLACK_BOT_TOKEN");
  const signingSecret = requireEnv("SLACK_SIGNING_SECRET");

  // App token is required for Socket Mode but optional in HTTP mode.
  // We attempt to read it and determine the mode based on its presence.
  const appToken = optionalEnv("SLACK_APP_TOKEN");
  const socketMode = Boolean(appToken);

  const rawPort = optionalEnv("SLACK_PORT");
  const port = rawPort ? parseInt(rawPort, 10) : 3001;

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `[Gravity/Slack] SLACK_PORT must be a valid port number (1–65535), got: "${rawPort}"`
    );
  }

  return Object.freeze<SlackConfig>({
    botToken,
    signingSecret,
    appToken: appToken ?? "",
    socketMode,
    port,
  });
}

let configInstance: SlackConfig | null = null;

/**
 * Returns the resolved, validated Slack configuration.
 * Lazily evaluated on first call to prevent side-effects at import/build time.
 */
export function getSlackConfig(): SlackConfig {
  if (!configInstance) {
    configInstance = buildSlackConfig();
  }
  return configInstance;
}
