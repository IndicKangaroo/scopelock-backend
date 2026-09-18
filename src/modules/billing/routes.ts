import { Router } from "express";
import { requireAuth } from "../../middleware/auth";

export const billingRouter = Router();

/**
 * Phase F (spec section 35) — later. GET /v1/subscription: entitlement
 * status (authenticated). TODO: read subscriptions/{uid} written by
 * the webhook below.
 */
billingRouter.get("/subscription", requireAuth, (req, res) => {
  res
    .status(501)
    .json({ error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase F — return entitlement status", requestId: req.id } });
});

export const webhooksRouter = Router();

/**
 * POST /v1/webhooks/revenuecat — NOT behind requireAuth (RevenueCat
 * calls this, not the app). Verify REVENUECAT_WEBHOOK_SECRET instead
 * of a Firebase token, and never trust client-supplied entitlement —
 * this webhook is meant to be the only writer of subscriptions/{uid}.
 * TODO: Phase F — verify signature, upsert subscriptions/{uid}.
 */
webhooksRouter.post("/revenuecat", (req, res) => {
  res.status(501).json({
    error: { code: "NOT_IMPLEMENTED", message: "TODO: Phase F — verify + handle RevenueCat webhook", requestId: req.id },
  });
});
