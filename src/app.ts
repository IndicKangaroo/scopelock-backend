import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { requestId } from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { v1Router } from "./routes";
import { logger } from "./utils/logger";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors()); // MVP: open CORS; tighten to the app/signing origins before release
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      // Keep logs free of anything the privacy section rules out.
      redact: ["req.headers.authorization"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  // Unauthenticated — used for deploy/monitoring checks (spec section 13).
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
