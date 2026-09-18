import { Router } from "express";
import { authRouter } from "../modules/auth/routes";
import { agreementsRouter } from "../modules/agreements/routes";
import { signingRouter } from "../modules/signing/routes";
import { billingRouter, webhooksRouter } from "../modules/billing/routes";

export const v1Router = Router();

v1Router.use(authRouter); // GET /v1/me
v1Router.use("/agreements", agreementsRouter);
v1Router.use("/sign", signingRouter);
v1Router.use(billingRouter); // GET /v1/subscription
v1Router.use("/webhooks", webhooksRouter); // POST /v1/webhooks/revenuecat
