import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns 200 ok without auth", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /v1/me", () => {
  it("rejects requests with no Authorization header", async () => {
    const app = createApp();
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(res.body.error.requestId).toBeTruthy();
  });
});

describe("unknown route", () => {
  it("returns the standard error envelope", async () => {
    const app = createApp();
    const res = await request(app).get("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(res.body.error.requestId).toBeTruthy();
  });
});
