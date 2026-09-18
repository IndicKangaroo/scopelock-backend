import type { NextFunction, Request, Response } from "express";
import { bootstrapUser } from "../modules/auth/service";

/**
 * Runs after requireAuth on any company-scoped route. Loads (and
 * bootstraps, if this is the caller's first request ever) the
 * users/{uid} doc and attaches companyId. Downstream handlers trust
 * req.user.companyId completely — it is never taken from the request
 * body/params/headers, which is what makes ownership-by-Firestore-path
 * (companies/{companyId}/changeOrders/{id}) actually safe.
 */
export async function attachCompanyContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const { uid, email } = req.user!;
    const record = await bootstrapUser(uid, email);
    req.user!.companyId = record.companyId;
    next();
  } catch (err) {
    next(err);
  }
}
