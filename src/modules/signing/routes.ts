import { Router } from "express";
import { signingActionRateLimit } from "../../middleware/rateLimit";

export const signingRouter = Router();

/**
 * Phase E (spec section 25) — deliberately not built first. These are
 * the endpoints the *customer* hits from a secure link, so they're
 * public by design: authorization comes from possessing a valid,
 * unexpired, unused signing token (store only a hash of it), not from
 * requireAuth. Rate-limited since they're a public surface.
 */

// GET /v1/sign/:token — signing data for the customer to review
signingRouter.get("/:token", signingActionRateLimit, (req, res) => {
  res
    .status(501)
    .json({ error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase E — load agreement by token hash", requestId: req.id } });
});

// POST /v1/sign/:token/view — customer opened the link (PARTY_VIEWED)
signingRouter.post("/:token/view", signingActionRateLimit, (req, res) => {
  res
    .status(501)
    .json({ error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase E — record PARTY_VIEWED", requestId: req.id } });
});

// POST /v1/sign/:token/approve — customer approval (PARTY_APPROVED)
signingRouter.post("/:token/approve", signingActionRateLimit, (req, res) => {
  res.status(501).json({
    error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase E — mark party APPROVED + audit event", requestId: req.id },
  });
});

// POST /v1/sign/:token/decline — customer decline (PARTY_DECLINED)
signingRouter.post("/:token/decline", signingActionRateLimit, (req, res) => {
  res.status(501).json({
    error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase E — mark party DECLINED + audit event", requestId: req.id },
  });
});
