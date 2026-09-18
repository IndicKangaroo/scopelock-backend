import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { attachCompanyContext } from "../../middleware/companyContext";
import { aiProcessingRateLimit } from "../../middleware/rateLimit";
import { extractAgreementFromTranscript } from "../ai/service";
import {
  createAgreementSchema,
  listAgreementsQuerySchema,
  processTranscriptSchema,
  updateAgreementSchema,
} from "./schema";
import * as agreements from "./service";

export const agreementsRouter = Router();
agreementsRouter.use(requireAuth, attachCompanyContext);

// --- Phase B: CRUD -----------------------------------------------------

// GET /v1/agreements — list records for the caller's company
agreementsRouter.get("/", async (req, res, next) => {
  try {
    const { limit } = listAgreementsQuerySchema.parse(req.query);
    const results = await agreements.listAgreements(req.user!.companyId!, limit);
    res.status(200).json({ agreements: results });
  } catch (err) {
    next(err);
  }
});

// POST /v1/agreements — create a draft (spec section 16)
agreementsRouter.post("/", async (req, res, next) => {
  try {
    const input = createAgreementSchema.parse(req.body ?? {});
    const created = await agreements.createAgreement(req.user!.companyId!, req.user!.uid, input);
    res.status(201).json({
      id: created.id,
      status: created.status,
      version: created.currentVersion,
      createdAt: created.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/agreements/:id — full detail incl. current contract (spec section 18)
agreementsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await agreements.getAgreement(req.user!.companyId!, req.params.id!);
    res.status(200).json({
      id: result.id,
      status: result.status,
      version: result.currentVersion,
      contract: result.contract,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      finalizedAt: result.finalizedAt,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /v1/agreements/:id — user edits (spec section 19); creates a new version
agreementsRouter.patch("/:id", async (req, res, next) => {
  try {
    const patch = updateAgreementSchema.parse(req.body);
    const updated = await agreements.updateAgreement(req.user!.companyId!, req.params.id!, patch, req.user!.uid);
    res.status(200).json({
      id: updated.id,
      status: updated.status,
      version: updated.currentVersion,
      contract: updated.contract,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

// --- Phase C: AI processing — the most important endpoint for MVP ------

// POST /v1/agreements/:id/process (spec section 17)
agreementsRouter.post("/:id/process", aiProcessingRateLimit, async (req, res, next) => {
  try {
    const { transcript, projectName } = processTranscriptSchema.parse(req.body);
    const companyId = req.user!.companyId!;
    const id = req.params.id!;

    // Confirms ownership before spending an AI call, and 404s early if the id is wrong.
    await agreements.getAgreement(companyId, id);
    await agreements.recordEvent(companyId, id, "TRANSCRIPT_RECEIVED", req.user!.uid);

    // Section 34: if this throws (AI_TIMEOUT / AI_INVALID_OUTPUT), nothing
    // below runs and nothing gets written — the transcript stays "received"
    // in the audit log but no draft is saved. Android can retry the same call.
    const extraction = await extractAgreementFromTranscript(transcript);
    // Android knows the project name up front (it's what names the eventual
    // PDF, spec section 23) — trust that over whatever title the AI guessed.
    if (projectName) {
      extraction.contract = { ...extraction.contract, title: projectName };
    }

    const updated = await agreements.applyAiExtraction(companyId, id, extraction, req.user!.uid);

    res.status(200).json({
      agreementId: updated.id,
      status: updated.status,
      contract: updated.contract,
    });
  } catch (err) {
    next(err);
  }
});

// --- Phase D: finalize ---------------------------------------------------

// POST /v1/agreements/:id/finalize (spec section 21) — idempotent
agreementsRouter.post("/:id/finalize", async (req, res, next) => {
  try {
    const updated = await agreements.finalizeAgreement(req.user!.companyId!, req.params.id!, req.user!.uid);
    res.status(200).json({
      agreementId: updated.id,
      status: updated.status,
      version: updated.currentVersion,
      finalizedAt: updated.finalizedAt,
    });
  } catch (err) {
    next(err);
  }
});

// --- Phase E: signing (future — spec section 25, do not build first) ---

// POST /v1/agreements/:id/signing-session
agreementsRouter.post("/:id/signing-session", (req, res) => {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "TODO: Phase E — create a signing session (spec section 25)",
      requestId: req.id,
    },
  });
});
