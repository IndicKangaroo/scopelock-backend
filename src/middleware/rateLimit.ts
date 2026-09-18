import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { ApiError } from "../utils/apiError";

/**
 * Factory so each expensive/sensitive route (AI processing today,
 * signing actions once section 25 lands) can pick its own window/max
 * instead of sharing one global setting — spec section 32 calls out
 * "rate limit the AI endpoint" specifically as a cost control.
 */
export function createRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.uid ?? req.ip ?? "unknown",
    handler: (req: Request, res: Response) => {
      const err = ApiError.rateLimited();
      res.status(err.status).json({ error: { code: err.code, message: err.message, requestId: req.id } });
    },
  });
}

// Sensible MVP defaults — tune once real usage/cost data comes in.
export const aiProcessingRateLimit = createRateLimiter(60_000, 10); // 10/min per user
export const signingActionRateLimit = createRateLimiter(60_000, 20); // 20/min per token/IP
