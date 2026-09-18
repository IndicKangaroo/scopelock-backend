# ScopeLock Backend

Node.js + Express + TypeScript API for ScopeLock — turns a verbal
agreement (any kind: service, work, payment, rental, change order,
delivery, business, other) into a structured, AI-extracted contract
draft that a contractor can review, edit, and finalize. Speech-to-text
and PDF generation both happen on Android — this backend never touches
audio and never generates a PDF.

## Setup

```bash
npm install
cp .env.example .env
# Firebase: fill in FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
# FIREBASE_PRIVATE_KEY from a service account JSON (Project settings >
# Service accounts, or follow docs/firebase-setup.md for the full
# checklist). AI: fill in OPENAI_API_KEY to exercise POST /:id/process
# for real.
npm run dev
```

`GET /health` works with no credentials — useful to confirm the server
is up before wiring auth.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run with hot reload (tsx watch) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run the vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Structure

```
src/
├── config/        env loading (Zod-validated) + Firebase Admin init
├── middleware/     requestId, auth (Firebase ID token), company context, rate limiting, error handler
├── modules/
│   ├── auth/        GET /v1/me — user/company bootstrap
│   ├── agreements/  the core entity: CRUD, versioning, finalize
│   ├── ai/           prompt, provider (OpenAI), extraction pipeline
│   ├── signing/      Phase E stub — future customer signing
│   ├── billing/      Phase F stub — future RevenueCat entitlement
│   └── notifications/ Phase G stub — future OneSignal triggers
├── routes/         mounts every module's router under /v1
├── types/          Express request augmentation (req.id, req.user)
├── utils/          logger, ApiError
├── app.ts          middleware chain + route mounting (exported for tests)
└── server.ts       listens on PORT
```

## What's implemented vs. stubbed

**Working now (Phases A–D):**
- `GET /health` — unauthenticated liveness check
- `GET /v1/me` — verifies the Firebase ID token, bootstraps `users/{uid}` + `companies/{companyId}` on first call
- `POST /v1/agreements`, `GET /v1/agreements`, `GET /v1/agreements/:id`, `PATCH /v1/agreements/:id` — full CRUD, versioned
- `POST /v1/agreements/:id/process` — **the core endpoint**: takes a transcript, calls the AI provider, validates the result, stores it as a new version, moves the agreement to `READY_FOR_REVIEW`
- `POST /v1/agreements/:id/finalize` — freezes the current version, sets `READY`, idempotent
- Error envelope: every error response is `{ error: { code, message, requestId } }` using the exact code vocabulary from the spec (`UNAUTHENTICATED`, `AGREEMENT_NOT_FOUND`, `INVALID_TRANSCRIPT`, `AI_TIMEOUT`, `AI_INVALID_OUTPUT`, `VALIDATION_ERROR`, `STATE_CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, ...)
- Rate limiting on `/process`
- Structured logging (pino), auth header redacted, silent in tests

**Stubbed (`501`, explicitly deferred — Phases E/F/G):** signing session + sign/view/approve/decline, subscription status, RevenueCat webhook, OneSignal notifications. Don't build these next just because they're visible in the router — see AGENTS.md's phase ordering.

## Try it

```bash
# after npm run dev, with a real Firebase ID token:
curl -X POST localhost:8080/v1/agreements -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{}'
# -> { "id": "...", "status": "DRAFT", "version": 0, "createdAt": "..." }

curl -X POST localhost:8080/v1/agreements/AGR_ID/process -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"transcript":"I will design a website for Rahul for 25000 rupees. The first version will be delivered by September 30 and payment will be made in two installments.","projectName":"Rahul Website Build"}'
# -> { "agreementId": "...", "status": "READY_FOR_REVIEW", "contract": { ...AI-extracted fields, title "Rahul Website Build"... } }
```

## Next steps (spec section 35's phase order)

Phases A–D above are done. Next:
- **Phase E** — signing: token generation (store a hash, not the raw
  value), the customer-facing page, `PARTY_VIEWED`/`APPROVED`/`DECLINED`
  audit events, multi-party approval status.
- **Phase F** — RevenueCat webhook verification, `subscriptions/{uid}`,
  entitlement enforcement.
- **Phase G** — OneSignal notification triggers.

## Notes

- Never log raw transcripts or secrets — the logger already redacts
  the auth header; keep that discipline in new log calls.
- `.env` is gitignored; only `.env.example` is committed.
- No Firebase project yet? See **docs/firebase-setup.md** for the full
  checklist (project creation, Auth, service account, Firestore).
- **docs/firestore-schema.md** documents every collection this backend
  reads/writes, field by field.
- See **AGENTS.md** before changing anything — it has the decision
  log and the reasoning behind things that aren't obvious from the
  code alone (especially the versioning scheme).
