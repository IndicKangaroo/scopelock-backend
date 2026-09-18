import type { NextFunction, Request, Response } from "express";
import { auth } from "../config/firebase";
import { ApiError } from "../utils/apiError";

const BEARER_PREFIX = "Bearer ";

/**
 * Verifies the Firebase ID token on every protected request (spec
 * section 6/12). On success, req.user = { uid, email } is available to
 * downstream handlers. Ownership checks (does this uid own this
 * change order / company) happen per-resource in the route handlers —
 * this middleware only establishes identity.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw ApiError.unauthenticated("Missing Authorization: Bearer <token> header");
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw ApiError.unauthenticated("Empty bearer token");
    }

    const decoded = await auth.verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    // firebase-admin throws its own error shapes for expired/revoked/malformed tokens.
    next(ApiError.unauthenticated("Invalid or expired token"));
  }
}
