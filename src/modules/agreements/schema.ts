import { z } from "zod";
import { AgreementType } from "./types";

const agreementTypeSchema = z.nativeEnum(AgreementType);

export const partySchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(100),
});

export const paymentSchema = z.object({
  totalAmount: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  terms: z.string().max(500).optional(),
});

export const responsibilitySchema = z.object({
  party: z.string().min(1).max(200),
  responsibility: z.string().min(1).max(1000),
});

/**
 * POST /v1/agreements body (spec section 16) — fires before any
 * capture happens, so everything is optional/nullable.
 */
export const createAgreementSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  agreementType: agreementTypeSchema.optional().default(AgreementType.OTHER),
});
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;

/**
 * PATCH /v1/agreements/:id body (spec section 19) — the fields a
 * contractor can hand-edit after reviewing the AI draft.
 */
export const updateAgreementSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    agreementType: agreementTypeSchema.optional(),
    parties: z.array(partySchema).max(20).optional(),
    scope: z.array(z.string().max(1000)).max(50).optional(),
    deliverables: z.array(z.string().max(1000)).max(50).optional(),
    payment: paymentSchema.nullable().optional(),
    deadline: z.string().max(200).nullable().optional(),
    responsibilities: z.array(responsibilitySchema).max(50).optional(),
    conditions: z.array(z.string().max(1000)).max(50).optional(),
    notes: z.array(z.string().max(1000)).max(50).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "At least one field is required" });
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>;

export const listAgreementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * POST /v1/agreements/:id/process body (spec section 17, extended).
 * `projectName` isn't in the original spec doc — Android sends it
 * alongside the transcript so the backend doesn't have to guess a
 * title from AI output; when present it overrides whatever title the
 * AI extracts (see routes.ts). Length cap on transcript is the
 * "maximum transcript length" cost control from section 32 —
 * generous enough for a long verbal exchange, small enough to bound
 * AI cost per call.
 */
export const processTranscriptSchema = z.object({
  transcript: z.string().min(10, "Transcript is too short to extract an agreement from").max(8000),
  projectName: z.string().min(1).max(200).optional(),
});
export type ProcessTranscriptInput = z.infer<typeof processTranscriptSchema>;

/**
 * What we require the AI's JSON response to look like (spec sections
 * 8/12). This is the actual enforcement of "never trust the AI
 * response" (section 15) — malformed or missing-required-field output
 * is rejected here, before it ever reaches Firestore or Android.
 */
export const contractDataSchema = z.object({
  title: z.string().nullable(),
  agreementType: agreementTypeSchema,
  parties: z.array(partySchema),
  scope: z.array(z.string()),
  deliverables: z.array(z.string()),
  payment: paymentSchema.nullable(),
  deadline: z.string().nullable(),
  responsibilities: z.array(responsibilitySchema),
  conditions: z.array(z.string()),
  notes: z.array(z.string()),
  missingInformation: z.array(z.string()),
});
