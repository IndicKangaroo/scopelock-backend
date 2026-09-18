import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";

/**
 * Kept as a narrow interface — not a class hierarchy — so a route
 * handler or test can pass any object shaped like this. The spec
 * doesn't mandate a specific AI vendor; this is the seam to swap one
 * in later without touching agreements/service.ts.
 */
export interface AiExtractionProvider {
  extract(input: { systemPrompt: string; userMessage: string }): Promise<string>;
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Real HTTP call to OpenAI's Chat Completions API. Requires
 * OPENAI_API_KEY (see .env.example). Uses `response_format: { type:
 * "json_object" }` (JSON mode) rather than strict JSON-schema mode —
 * that keeps this independent of a schema-conversion dependency, and
 * ai/service.ts's Zod validation is the actual safety net either way
 * (see AGENTS.md decision 19: never trust the AI response, JSON mode
 * or not). Network/timeout failures become ApiError.aiTimeout so the
 * route handler doesn't need to know this is OpenAI specifically.
 */
export const openaiProvider: AiExtractionProvider = {
  async extract({ systemPrompt, userMessage }) {
    if (!env.OPENAI_API_KEY) {
      throw ApiError.internal("OPENAI_API_KEY is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw ApiError.aiTimeout();
      }
      throw ApiError.aiTimeout("Could not reach the AI provider");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Provider-side failure (bad key, rate limited upstream, etc.) —
      // don't leak provider internals to the client (spec section 33).
      throw ApiError.aiTimeout(`AI provider responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; refusal?: string } }>;
    };
    const choice = data.choices?.[0]?.message;

    if (choice?.refusal) {
      throw ApiError.aiInvalidOutput(choice.refusal);
    }
    if (!choice?.content) {
      throw ApiError.aiInvalidOutput("AI provider returned no content");
    }

    return choice.content;
  },
};
