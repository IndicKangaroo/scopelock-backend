import "express";

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, set by requestId middleware, logged throughout the request lifecycle. */
      id: string;
      /** Populated by the auth middleware after Firebase ID token verification. */
      user?: {
        uid: string;
        email?: string;
        /** Set by attachCompanyContext, never trust a client-supplied value for this. */
        companyId?: string;
      };
    }
  }
}
