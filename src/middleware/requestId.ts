import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Assigns req.id (reusing an inbound x-request-id if the client/proxy
 * sent one) and echoes it back on the response so it can be correlated
 * client-side and in logs.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  req.id = incoming && incoming.length > 0 ? incoming : uuidv4();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}
