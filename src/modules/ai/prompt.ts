/**
 * Bump this whenever buildExtractionSystemPrompt's instructions
 * change in a way that could alter output shape/behavior. Stored on
 * every AI_DRAFT version doc (spec section 28) so we can tell which
 * prompt produced a given draft.
 */
export const AGREEMENT_EXTRACTION_PROMPT_VERSION = "1.0";

const AGREEMENT_TYPES = ["SERVICE", "WORK", "PAYMENT", "RENTAL", "CHANGE_ORDER", "DELIVERY", "BUSINESS", "OTHER"];

/**
 * Spec section 14, made concrete with the exact field names from the
 * contractDataSchema so the model's JSON lines up with what we
 * validate it against.
 */
export function buildExtractionSystemPrompt(): string {
  return `You are ScopeLock's agreement extraction engine.

Your job is to convert a natural-language description of an agreement
between two or more parties into structured contract information.

Extract only information explicitly stated or clearly implied by the
provided transcript. Do not invent:
- names
- prices
- dates
- responsibilities
- legal clauses
- conditions
- deliverables

If required information is missing, list it in "missingInformation"
instead of guessing. The result is a draft for human review — never
claim it is legally binding, and do not provide legal advice.

Return ONLY valid JSON (no markdown, no commentary, no code fences)
matching exactly this shape:

{
  "title": string | null,
  "agreementType": one of ${JSON.stringify(AGREEMENT_TYPES)},
  "parties": [{ "name": string, "role": string }],
  "scope": string[],
  "deliverables": string[],
  "payment": { "totalAmount"?: number, "currency"?: string, "terms"?: string } | null,
  "deadline": string | null,
  "responsibilities": [{ "party": string, "responsibility": string }],
  "conditions": string[],
  "notes": string[],
  "missingInformation": string[]
}`;
}

export function buildExtractionUserMessage(transcript: string): string {
  return `Transcript:\n"""\n${transcript}\n"""\n\nReturn only the JSON object described in the system prompt.`;
}
