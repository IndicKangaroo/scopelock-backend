import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiError";
import { logger } from "../utils/logger";

/**
 * Last middleware in the chain. Converts any thrown error into the
 * { error: { code, message, requestId } } shape spec section 33
 * requires, and makes sure unexpected errors never leak internals to
 * the client (spec section 34: on AI/internal failure, the transcript
 * and existing data stay untouched — this handler never deletes
 * anything, it only shapes the response).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error({ err, requestId: req.id }, "request failed");
    } else {
      logger.warn({ code: err.code, requestId: req.id }, err.message);
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message, requestId: req.id } });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ issues: err.issues, requestId: req.id }, "validation failed");
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request failed validation", requestId: req.id },
    });
    return;
  }

  logger.error({ err, requestId: req.id }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error", requestId: req.id } });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found", requestId: req.id } });
}
