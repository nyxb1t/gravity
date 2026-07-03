/**
 * @file ai/engine/llm.ts
 * @description Provider-agnostic LLM adapter.
 *
 * This is the only place in the Gravity codebase that makes external HTTP
 * calls to an AI provider. Every other module is pure TypeScript with no I/O.
 *
 * Supported providers:
 *  - "openai"    → OpenAI Chat Completions API (gpt-4o, etc.)
 *  - "anthropic" → Anthropic Messages API (claude-3-5-sonnet, etc.)
 *  - "google"    → Google Generative Language API (gemini-2.0-flash, etc.)
 *  - "mock"      → Canned in-process response. No network. No API key.
 *                  This is the default and makes the orchestrator fully
 *                  functional in offline / CI environments.
 *
 * All adapters:
 *  - Throw a descriptive `Error` on non-2xx responses.
 *  - Return the raw assistant text string (not parsed JSON).
 *  - Are `async` and return `Promise<string>`.
 *
 * To add a new provider:
 *  1. Add its name to `LLMProvider` in `types.ts`.
 *  2. Implement a `callXxx` function below.
 *  3. Add a `case` in the `callLLM` switch.
 */

import type { LLMConfig, OrchestratorMode } from "./types";

// ---------------------------------------------------------------------------
// Mock canned responses
// ---------------------------------------------------------------------------

/**
 * Canned JSON responses for the mock provider.
 *
 * Each value is a minimal but structurally valid response matching the
 * schema expected by the corresponding parser in `parser.ts`.
 */
const MOCK_RESPONSES: Record<OrchestratorMode, string> = {
  lens: JSON.stringify({
    lensItems: [],
  }),
  search: JSON.stringify({
    results: [],
  }),
  conflicts: JSON.stringify({
    conflicts: [],
  }),
};

/**
 * Detects which orchestrator mode produced the prompt by looking for
 * mode-specific sentinel strings that the assembler always includes.
 */
function detectModeFromPrompt(prompt: string): OrchestratorMode {
  if (prompt.includes("\"lensItems\"")) return "lens";
  if (prompt.includes("\"relevanceScore\"")) return "search";
  return "conflicts";
}

// ---------------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------------

async function callOpenAI(prompt: string, config: LLMConfig): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey ?? ""}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxTokens ?? 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    throw new Error(`OpenAI API error ${res.status} ${res.statusText}: ${body}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string, config: LLMConfig): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    throw new Error(`Anthropic API error ${res.status} ${res.statusText}: ${body}`);
  }

  const json = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  return json.content?.[0]?.text ?? "";
}

async function callGoogle(prompt: string, config: LLMConfig): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey ?? ""}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxTokens ?? 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    throw new Error(`Google AI API error ${res.status} ${res.statusText}: ${body}`);
  }

  const json = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function callMock(prompt: string): string {
  const mode = detectModeFromPrompt(prompt);
  return MOCK_RESPONSES[mode];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Routes the assembled prompt to the configured LLM provider and returns
 * the raw text response.
 *
 * @param prompt - The full, assembled prompt string.
 * @param config - LLM provider configuration.
 * @returns       Raw text response from the provider (not parsed).
 * @throws        `Error` if the provider returns a non-2xx HTTP status.
 */
export async function callLLM(
  prompt: string,
  config: LLMConfig
): Promise<string> {
  switch (config.provider) {
    case "openai":
      return callOpenAI(prompt, config);
    case "anthropic":
      return callAnthropic(prompt, config);
    case "google":
      return callGoogle(prompt, config);
    case "mock":
      return Promise.resolve(callMock(prompt));
    default: {
      // Exhaustive check — if a new provider is added to the type but not
      // handled here, TypeScript will surface it as an error.
      const _never: never = config.provider;
      throw new Error(`Unhandled LLM provider: ${_never}`);
    }
  }
}
