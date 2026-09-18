# AGENTS.md — ScopeLock Backend

This file is context for anyone (human or AI agent) working on this
codebase: what exists, why it's built the way it is, and the
conventions to follow when adding to it. Update it in the same
turn/PR as any change that alters a decision recorded here — this
file is useless if it drifts from the code.

Scope: `backend/` only. `android/`, `contracts/`, `docs/` don't exist
yet — when they're added, either promote this file to the repo root
or give each its own.

---

## 0. Product pivot — Agreement replaces ChangeOrder

The backend was originally built around a `ChangeOrder` entity
(contractor extra-work requests, audio uploaded to the backend,
backend-generated PDFs, a 10-day phased plan). A revised spec then
redirected the product: the core entity is now a generic **Agreement**
(any verbal agreement between two-or-more parties — service, work,
payment, rental, change order, delivery, business, other), Android
does speech-to-text AND PDF generation (never the backend), and the
single most important endpoint is `POST /agreements/:id/process`
(transcript in, AI-structured contract JSON out).

What that meant concretely, in case a similar pivot happens again and
someone needs to see how much surface area it touched:
- Deleted the entire `change-orders` module and the `pdf` module
  (backend doesn't generate PDFs at all now — see decision 16).
- Deleted the audio-upload endpoint entirely (Android never sends
  audio to this backend — see decision 15).
- Renamed the core entity and rebuilt `types`/`schema`/`service`/`routes`
  from scratch as `modules/agreements/`.
- Changed the error envelope from flat `{code,message,requestId}` to
  nested `{error:{code,message,requestId}}`, and swapped the error
  code vocabulary to the spec's exact list (`UNAUTHENTICATED`,
  `AGREEMENT_NOT_FOUND`, `INVALID_TRANSCRIPT`, `AI_TIMEOUT`,
  `AI_INVALID_OUTPUT`, `VALIDATION_ERROR`, `STATE_CONFLICT`,
  `RATE_LIMITED`, `INTERNAL_ERROR`) — see decision 17.
- Built the `ai` module for real: a versioned system prompt, a
  pluggable provider interface, and an OpenAI implementation — this
  didn't exist before (previously a stub that threw "not implemented").
- Renamed the 10-day-plan TODOs to the new spec's Phase A–G ordering.
- Kept, basically unchanged: `config/env.ts`, `config/firebase.ts`,
  `middleware/auth.ts`, `middleware/companyContext.ts`,
  `middleware/requestId.ts`, `modules/auth/*` (user/company bootstrap
  is orthogonal to what the core entity is called).

If you're reading this after another pivot: grep this file for
"decision" and skim which ones reference the old ChangeOrder model —
those are the ones likely to need re-deciding again.

---

## 1. Project snapshot

**ScopeLock** turns a verbal agreement into a structured, reviewable
contract:

```
Android: Voice -> SpeechRecognizer -> English text -> user edits -> JSON
Backend: transcript -> AI extraction -> validated contract JSON
Android: contract JSON -> editable preview -> final contract -> PDF -> share
```

The customer/other party needs no ScopeLock account — the creator
shares a PDF through normal Android sharing. Digital signing
(so the other party can approve online) is a later phase, not MVP.

Current backend milestone (Phases A–D, all done): receive a
transcript, validate it, send it to the AI, get back contract JSON,
validate that JSON, store it, return it. Everything past that —
signing, RevenueCat, OneSignal — is explicitly deferred; don't build
it early (spec section 41, "do not overengineer").

Stack: Node.js + Express + TypeScript, Firebase (Auth/Firestore — no
Storage usage today), Zod validation, OpenAI API for extraction.
One Express service, no microservices.

---

## 2. Current status

**Implemented and tested (13 tests, all passing):**
- `GET /health` — unauthenticated liveness check
- `GET /v1/me` — verifies Firebase ID token, bootstraps `users/{uid}` + `companies/{companyId}` on first call
- `POST /v1/agreements`, `GET /v1/agreements`, `GET /v1/agreements/:id`, `PATCH /v1/agreements/:id`
- `POST /v1/agreements/:id/process` — the AI extraction endpoint
- `POST /v1/agreements/:id/finalize` — idempotent
- Auth middleware, company-context middleware, error envelope, rate limiting, structured logging

**Stubbed (`501`, code `NOT_IMPLEMENTED`, comment cites the Phase it belongs to):**
`POST /:id/signing-session`, `GET/POST /v1/sign/:token[/view|/approve|/decline]`
(Phase E), `GET /v1/subscription`, `POST /v1/webhooks/revenuecat`
(Phase F). `notifications` is a service placeholder with no route
(Phase G).

**Not started:** everything in Phase E onward. No PDF generation
exists or is planned server-side (see decision 16) — if that changes,
it changes the spec first, then this file, then the code.

---

## 3. Decisions and why

Numbering continues from the pre-pivot log rather than restarting, so
history stays traceable. Entries 1–14 predate the pivot (see section 0)
and describe the old ChangeOrder model; kept for history, not current
behavior, except where noted as "still true."

1–14. *(Pre-pivot: one Express service / no microservices — still
true; TypeScript strict + CommonJS — still true; Zod env validation
with a test-mode dummy Firebase key — still true; requestId echoed as
`x-request-id` — still true; CORS wide open for MVP, tighten before
ship — still true; `.env` gitignored — still true. The rest —
ChangeOrder-specific ownership/rate-limit/stub reasoning — superseded
by entries below.)*

15. **No audio endpoint exists, full stop.** The old spec had
    `POST /:id/audio` for a Cloud Storage upload session; the new spec
    is explicit (section 3) that audio never reaches the backend —
    Android's `SpeechRecognizer` produces text, backend receives text.
    There is nothing to build here later; this isn't a stub, it's a
    permanently absent endpoint.

16. **No PDF endpoint exists either.** Android generates the PDF from
    the final contract JSON (spec section 22/23) using a filename it
    derives from `contract.title`. The backend's only job re: PDFs is
    to keep `title` clean enough for Android to build a filename from.
    Spec section 22 explicitly says a future `GET/POST
    /agreements/:id/pdf` *could* exist but "do not implement this
    unless requested" — so it isn't in the router even as a stub,
    unlike the Phase E/F endpoints below.

17. **Error envelope is nested (`{error:{code,message,requestId}}`),
    with a fixed code enum.** This is spec section 33's literal
    contract for Android — `ApiError`'s static constructors
    (`unauthenticated`, `agreementNotFound`, `invalidTranscript`,
    `aiTimeout`, `aiInvalidOutput`, `validation`, `stateConflict`,
    `rateLimited`, `internal`) are the only sanctioned way to produce
    an error response. Don't add a new code without adding it to
    `ApiErrorCode` here and flagging it to whoever owns the spec doc —
    Android will pattern-match on these strings.

18. **~~AI provider is Anthropic~~ — superseded by decision 28.** Kept
    for history: it was initially built against Anthropic because
    `api.anthropic.com` was the only AI-vendor domain reachable from
    this build sandbox, which made the integration testable for real
    instead of guessed at. The provider interface (decision 28) is
    exactly why the actual swap to OpenAI later was a one-file change.

19. **The extraction pipeline never trusts the AI's output.**
    `ai/service.ts` strips an accidental code fence, `JSON.parse`s,
    then Zod-validates against `contractDataSchema` (spec section 15's
    exact pipeline). Either failure becomes `AI_INVALID_OUTPUT` and
    *nothing gets written* — no partial save, transcript itself was
    already logged as received (spec section 34: on AI failure, the
    transcript stays safe, nothing is deleted, Android can retry).

20. **The system prompt lives in its own file (`ai/prompt.ts`), not
    inline in a controller, and carries an explicit version string
    (`AGREEMENT_EXTRACTION_PROMPT_VERSION`).** Spec section 14 asks for
    exactly this. The version is stored on every `AI_DRAFT` version
    doc so a bad batch of drafts can be traced to the prompt that
    produced them.

21. **Versioning: the Agreement doc holds summary fields
    (`title`/`agreementType`/`parties`/`status`/`currentVersion`/
    timestamps); each `versions/{n}` subdoc holds the full
    `contractData` snapshot.** This is spec section 28's shape, and
    the reasoning is denormalization for cheap list reads — `GET
    /agreements` never has to fetch a version subdoc, only `GET
    /agreements/:id` does. Version subdocs are keyed by their own
    version number as a string ("1", "2", ...) specifically so
    "fetch the current version" is a direct `.doc(String(n)).get()`,
    not a query.

22. **`POST /:id/process` and `PATCH /:id` both create a new version;
    `POST /:id/finalize` does not.** "Freeze current version" (spec
    section 21) is read literally: finalize locks in whatever version
    already exists, it doesn't snapshot a new one. Confirmed against
    the worked example in spec section 20 (AI draft = version 1, user
    edit = version 2, finalize's response shows version 2 — i.e. the
    version number carries over unchanged through finalize).

23. **Open question, flagged rather than silently resolved: what
    version number does a brand-new, unprocessed agreement have?**
    Spec section 16's example response shows `"version": 1` on an
    agreement that was *just created* (no AI draft, no edits yet).
    Spec section 20's versioning walkthrough labels the *AI draft
    itself* as "Version 1." These two examples conflict — an empty
    draft can't be version 1 in both places at once. Implemented per
    section 20 (the more detailed, worked example): `currentVersion:
    0` at creation, meaning "no content yet"; the first AI draft
    becomes version 1. **Confirm this with whoever owns the spec
    before Android hard-codes against the literal `"version": 1`
    creation example** — if they intended creation to start at 1, that's
    a one-line change in `agreements/service.ts`'s `createAgreement`.

24. **`EDITABLE_STATUSES`-style status gating was dropped for PATCH.**
    The old ChangeOrder model blocked edits once a resource left
    DRAFT/READY. The new spec doesn't ask for that on `Agreement` —
    section 19 just says verify ownership, verify current state,
    validate, save, version. Since nothing beyond `READY` is reachable
    yet (signing/Phase E isn't built), there's no state to protect
    against yet. Revisit once Phase E lands: spec section 20 explicitly
    warns not to silently modify a *signed* version — that guard
    belongs in `updateAgreement` once a SIGNED-equivalent status
    exists.

25. **`ownership check → cost` ordering in `/process`.** The route
    calls `agreements.getAgreement()` (which 404s if the id doesn't
    belong to the caller's company) *before* touching the AI provider,
    specifically so a wrong/foreign id fails fast without spending an
    AI call. Spec section 32 (cost control) is the reasoning.

26. **Rate limiting stayed per-route via the same `createRateLimiter`
    factory from the pre-pivot build**, applied to `/process` only
    for now (10/min per uid) — that's the one spec section 32 calls
    out by name. Signing-action limits will come back once Phase E
    routes are real instead of stubs.

27. **Tests fake Firestore/Auth at the `config/firebase` module
    boundary (`tests/helpers/fakeFirebase.ts`), and fake the AI vendor
    at the `modules/ai/provider` boundary** — not by mocking `fetch`
    directly, and not via a live Firestore emulator (none is
    reachable in this build environment; `firebase.google.com` /
    `googleapis.com` aren't on the network allowlist here). The fake
    Firestore implements only the subset of the API this codebase
    calls and does not model real Firestore semantics (indexes,
    security rules, query planning) — these are logic/wiring tests for
    *our* code, not integration tests of Firestore or the AI provider
    itself. Before relying on this in CI against production-shaped
    data, add real Firestore-emulator + recorded-AI-response
    integration tests.

28. **Switched the AI provider from Anthropic to OpenAI.** Not a
    build-environment choice this time — the person building this only
    has an OpenAI API key, so that's what production will actually
    run on. `provider.ts` now calls OpenAI's Chat Completions endpoint
    with `response_format: {type:"json_object"}` (JSON mode) rather
    than strict JSON-schema mode, to avoid adding a schema-conversion
    dependency — `ai/service.ts`'s Zod validation (decision 19) is
    already the real safety net regardless of which mode the vendor
    offers. Default model is `gpt-5.5` (current flagship as of this
    write), overridable via `OPENAI_MODEL` — pin to a dated snapshot
    for production per OpenAI's own guidance. This build sandbox can't
    reach `api.openai.com` either (same as it couldn't reach
    `api.anthropic.com`), so decision 27's testing approach — fake the
    vendor at the `modules/ai/provider` boundary — didn't need to
    change, only which export it fakes.

29. **`POST /:id/process` accepts an optional `projectName` alongside
    `transcript`, not in the original spec doc.** Android sends both
    together; when `projectName` is present it overrides whatever
    `title` the AI extracted, before the version is saved. Reasoning:
    spec section 23 says the backend should provide a clean
    project/title field so Android can build a PDF filename from it —
    if Android already knows the project name at capture time, that's
    a more reliable filename source than hoping the AI's own title
    guess matches. The override happens in `routes.ts`, not
    `agreements/service.ts` — `applyAiExtraction` just persists
    whatever `contract.title` it's given, it doesn't know the value
    came from Android rather than the model.

30. **Firebase project setup is documented, not automated.** Creating
    the actual Firebase project, enabling Auth sign-in methods, and
    generating a service account are Google-account-bound console
    actions — nothing in this repo can do them. `docs/firebase-setup.md`
    is the checklist; `firestore.rules` (deny-all — only the backend's
    Admin SDK touches Firestore, this is a safety net not the real
    access control) and `firestore.indexes.json` (empty — every
    current query is a single-field `orderBy`, which Firestore
    indexes automatically) are real, deployable config, committed so
    `firebase deploy --only firestore:rules,firestore:indexes` works
    once a project exists.

31. **Firestore schema lives in `docs/firestore-schema.md` as explicit
    markdown tables, separate from the scattered code comments that
    described it before.** Firestore has no literal tables — this is
    the closest equivalent, and it's the doc to update (alongside
    decision 21 above) if a collection's shape changes. Code comments
    in `agreements/service.ts` stay as short pointers, not the full
    description, to avoid the two drifting out of sync in two places.

---

## 4. Conventions for adding code here

- **New route on an existing spec endpoint:** replace the `501` stub
  in the relevant `routes.ts`. Remove the "TODO — Phase X" comment
  once it's real.
- **New error path:** throw `ApiError.<helper>(...)` — never
  hand-construct `{error:{...}}` JSON in a route. If no existing
  helper fits, that likely means a new code is needed; add it to
  `ApiErrorCode` and flag it (decision 17).
- **Anything that touches Firestore:** company-scoping happens via
  `attachCompanyContext` + reading/writing under
  `companies/{companyId}/...` — never trust a client-supplied
  companyId (spec section 30).
- **Anything expensive or public-facing:** wrap it with
  `createRateLimiter(windowMs, max)` and say in a comment why that
  window/max.
- **AI prompt changes:** bump `AGREEMENT_EXTRACTION_PROMPT_VERSION` in
  `ai/prompt.ts` whenever the instructions change in a way that could
  alter output shape/behavior.
- **Logging:** use `logger`/`req.log`, never `console.log`. Never log
  transcripts, contract contents, or secrets — log ids and status
  transitions only.
- **Before considering a change done:** `npm run lint && npm run
  typecheck && npm test && npm run build` all clean.
- **Idempotency:** `finalize` must stay idempotent (spec section 21's
  response shape doesn't distinguish first-call from repeat-call).

---

## 5. Open decisions (not yet made or confirmed)

- **Decision 23 above** — confirm the intended `currentVersion` at
  creation (0 vs. 1) with whoever owns the spec.
- **Decision 29 above** — `projectName` isn't in the original spec
  doc; confirm Android is actually sending it before relying on the
  override behavior.
- Backend host (spec doesn't say).
- Phase E signing UX (spec section 25 lists endpoints but not the
  actual customer-facing page design).
- Package ID / repository finalization — needed before Firebase Auth
  setup's Android app registration (docs/firebase-setup.md step 2).
- OneSignal/RevenueCat environments and any Play Console products,
  once Phases F–G start.
- OpenAI cost/rate limits at real usage — `OPENAI_MODEL` defaults to
  a flagship model; worth benchmarking a cheaper/faster variant
  against extraction quality once there's real usage to test against.

Resolve the version-numbering question (23) before Android codes
against literal example responses from spec section 16.
