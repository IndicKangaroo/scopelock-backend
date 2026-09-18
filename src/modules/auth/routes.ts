import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { bootstrapUser } from "./service";

export const authRouter = Router();

/**
 * GET /v1/me — current user + company, per spec's Suggested API table.
 * Bootstraps users/{uid} + companies/{companyId} on first call for a
 * given uid; subsequent calls just return the existing record.
 */
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { uid, email } = req.user!;
    const record = await bootstrapUser(uid, email);
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
});
