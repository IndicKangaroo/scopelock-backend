import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () => {
  const { createFakeFirebase } = await import("./helpers/fakeFirebase");
  return createFakeFirebase();
});

const validContractJson = JSON.stringify({
  title: "Website Development Agreement",
  agreementType: "SERVICE",
  parties: [
    { name: "Alex", role: "Service Provider" },
    { name: "Rahul Sharma", role: "Client" },
  ],
  scope: ["Design and develop a website"],
  deliverables: ["First website version"],
  payment: { totalAmount: 25000, currency: "INR", terms: "Two installments" },
  deadline: "September 30",
  responsibilities: [
    { party: "Alex", responsibility: "Design and develop the website" },
    { party: "Rahul Sharma", responsibility: "Make payment in two installments" },
  ],
  conditions: [],
  notes: [],
  missingInformation: [],
});

// Drives the fake AI provider off the transcript text itself, so each
// test controls its own outcome without shared mutable mock state.
vi.mock("../src/modules/ai/provider", () => ({
  openaiProvider: {
    extract: vi.fn(async ({ userMessage }: { userMessage: string }) => {
      if (userMessage.includes("TRIGGER_MALFORMED")) return "this is not json {";
      return validContractJson;
    }),
  },
}));

const { createApp } = await import("../src/app");

const AUTH_A = { Authorization: "Bearer valid-token-a" };
const AUTH_B = { Authorization: "Bearer valid-token-b" };
const LONG_ENOUGH_TRANSCRIPT =
  "I will design a website for Rahul for 25000 rupees, delivered by September 30, paid in two installments.";

describe("agreement CRUD", () => {
  it("creates a DRAFT with version 0, lists it, and fetches an empty contract", async () => {
    const app = createApp();

    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({ title: "Website project" });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("DRAFT");
    expect(created.body.version).toBe(0);
    const id = created.body.id;

    const list = await request(app).get("/v1/agreements").set(AUTH_A);
    expect(list.status).toBe(200);
    expect(list.body.agreements).toHaveLength(1);

    const detail = await request(app).get(`/v1/agreements/${id}`).set(AUTH_A);
    expect(detail.status).toBe(200);
    expect(detail.body.contract.title).toBe("Website project");
    expect(detail.body.contract.scope).toEqual([]);
  });

  it("PATCH creates a new version and rejects an empty body", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const id = created.body.id;

    const updated = await request(app)
      .patch(`/v1/agreements/${id}`)
      .set(AUTH_A)
      .send({ title: "Repair Agreement", scope: ["Fix the leaking pipe"] });
    expect(updated.status).toBe(200);
    expect(updated.body.version).toBe(1);
    expect(updated.body.contract.scope).toEqual(["Fix the leaking pipe"]);

    const empty = await request(app).patch(`/v1/agreements/${id}`).set(AUTH_A).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("404s with AGREEMENT_NOT_FOUND for an unknown id", async () => {
    const app = createApp();
    const res = await request(app).get("/v1/agreements/does-not-exist").set(AUTH_A);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("AGREEMENT_NOT_FOUND");
  });

  it("scopes agreements by company — user B cannot see user A's agreement", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});

    const asB = await request(app).get(`/v1/agreements/${created.body.id}`).set(AUTH_B);
    expect(asB.status).toBe(404);

    const listAsB = await request(app).get("/v1/agreements").set(AUTH_B);
    expect(listAsB.body.agreements).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const app = createApp();
    const res = await request(app).get("/v1/agreements");
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/agreements/:id/process", () => {
  it("extracts a contract from a transcript and moves to READY_FOR_REVIEW", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const id = created.body.id;

    const processed = await request(app)
      .post(`/v1/agreements/${id}/process`)
      .set(AUTH_A)
      .send({ transcript: LONG_ENOUGH_TRANSCRIPT });

    expect(processed.status).toBe(200);
    expect(processed.body.status).toBe("READY_FOR_REVIEW");
    expect(processed.body.contract.title).toBe("Website Development Agreement");
    expect(processed.body.contract.parties).toHaveLength(2);
    expect(processed.body.contract.payment.totalAmount).toBe(25000);

    const detail = await request(app).get(`/v1/agreements/${id}`).set(AUTH_A);
    expect(detail.body.version).toBe(1);
  });

  it("projectName from the request overrides the AI-extracted title", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const id = created.body.id;

    const processed = await request(app)
      .post(`/v1/agreements/${id}/process`)
      .set(AUTH_A)
      .send({ transcript: LONG_ENOUGH_TRANSCRIPT, projectName: "Rahul Website Build" });

    expect(processed.status).toBe(200);
    expect(processed.body.contract.title).toBe("Rahul Website Build");

    const detail = await request(app).get(`/v1/agreements/${id}`).set(AUTH_A);
    expect(detail.body.contract.title).toBe("Rahul Website Build");
  });

  it("rejects a too-short transcript before calling the AI", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const res = await request(app)
      .post(`/v1/agreements/${created.body.id}/process`)
      .set(AUTH_A)
      .send({ transcript: "too short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns AI_INVALID_OUTPUT and saves nothing when the model returns malformed JSON", async () => {
    const app = createApp();
    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const id = created.body.id;

    const res = await request(app)
      .post(`/v1/agreements/${id}/process`)
      .set(AUTH_A)
      .send({ transcript: `${LONG_ENOUGH_TRANSCRIPT} TRIGGER_MALFORMED` });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("AI_INVALID_OUTPUT");

    // Nothing should have been saved — still DRAFT, still version 0.
    const detail = await request(app).get(`/v1/agreements/${id}`).set(AUTH_A);
    expect(detail.body.status).toBe("DRAFT");
    expect(detail.body.version).toBe(0);
  });
});

describe("POST /v1/agreements/:id/finalize", () => {
  it("freezes the current version, is idempotent, and rejects an empty draft", async () => {
    const app = createApp();

    const empty = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const conflictRes = await request(app).post(`/v1/agreements/${empty.body.id}/finalize`).set(AUTH_A);
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe("STATE_CONFLICT");

    const created = await request(app).post("/v1/agreements").set(AUTH_A).send({});
    const id = created.body.id;
    await request(app).post(`/v1/agreements/${id}/process`).set(AUTH_A).send({ transcript: LONG_ENOUGH_TRANSCRIPT });

    const finalized = await request(app).post(`/v1/agreements/${id}/finalize`).set(AUTH_A);
    expect(finalized.status).toBe(200);
    expect(finalized.body.status).toBe("READY");
    expect(finalized.body.version).toBe(1); // freezes in place, doesn't bump

    const again = await request(app).post(`/v1/agreements/${id}/finalize`).set(AUTH_A);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe("READY");
  });
});
