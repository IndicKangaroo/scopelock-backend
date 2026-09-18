import { ApiError } from "../../utils/apiError";
import { contractDataSchema } from "../agreements/schema";
import type { ContractData } from "../agreements/types";
import { AGREEMENT_EXTRACTION_PROMPT_VERSION, buildExtractionSystemPrompt, buildExtractionUserMessage } from "./prompt";
import { openaiProvider, type AiExtractionProvider } from "./provider";

/**
 * Strips a ```json ... ``` fence if the model wrapped its output in
 * one despite being told not to — cheap robustness, not a substitute
 * for the schema validation below.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

export interface ExtractionResult {
  contract: ContractData;
  promptVersion: string;
}

/**
 * Spec section 15's pipeline, exactly: AI response -> JSON parse ->
 * schema validation -> (business validation happens in the caller,
 * which knows about ownership/state) -> return. Never trust the AI
 * response (section 15) — a parse or schema failure here becomes
 * AI_INVALID_OUTPUT and nothing gets saved (section 34: the original
 * transcript is untouched either way, since this function doesn't
 * write anything).
 */
export async function extractAgreementFromTranscript(
  transcript: string,
  provider: AiExtractionProvider = openaiProvider,
): Promise<ExtractionResult> {
  const raw = await provider.extract({
    systemPrompt: buildExtractionSystemPrompt(),
    userMessage: buildExtractionUserMessage(transcript),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw ApiError.aiInvalidOutput();
  }

  const result = contractDataSchema.safeParse(parsed);
  if (!result.success) {
    throw ApiError.aiInvalidOutput();
  }

  return { contract: result.data, promptVersion: AGREEMENT_EXTRACTION_PROMPT_VERSION };
}
