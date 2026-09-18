import pino from "pino";
import { env } from "../config/env";

/**
 * Structured JSON logs in production; pretty-printed in dev.
 * Never pass raw audio, transcripts, customer documents, or secrets
 * to this logger — see spec section 12 (Security & Privacy).
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : env.NODE_ENV === "test" ? "silent" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  redact: ["req.headers.authorization"],
});
