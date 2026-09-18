# Firestore Schema

Firestore is document-oriented, not relational — there's no literal
"table" here, but these are the collections this backend reads and
writes, laid out the same way a table reference would be. This is the
source of truth; if the code and this doc disagree, fix whichever one
is wrong and note it in AGENTS.md decision 21.

Nothing here is created by a migration — Firestore collections come
into existence the first time a document is written to them. There's
no schema to "run"; this doc is descriptive, not executable.

## `users/{uid}`

One doc per Firebase Auth user. `{uid}` is the Firebase Auth UID.
Created by `modules/auth/service.ts`'s `bootstrapUser`, the first time
a given uid calls any authenticated endpoint.

| Field | Type | Notes |
|---|---|---|
| `name` | `string \| null` | Not collected anywhere yet — always `null` today |
| `email` | `string \| null` | From the Firebase ID token at bootstrap time |
| `companyId` | `string` | FK-equivalent, points at `companies/{companyId}` |
| `createdAt` | `Timestamp` | Server timestamp, set once |
| `updatedAt` | `Timestamp` | Server timestamp |

## `companies/{companyId}`

One doc per company. `{companyId}` is an auto-generated Firestore ID.
Created alongside the user's doc, in the same batch, on first
bootstrap — every user currently gets their own company (no invite/
multi-user-per-company flow exists yet).

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Defaults to `"<email-local-part>'s Company"` |
| `ownerUid` | `string` | The uid that created it |
| `plan` | `string` | Always `"free"` today — Phase F (RevenueCat) will change this |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

## `companies/{companyId}/agreements/{agreementId}`

The core entity. `{agreementId}` is an auto-generated Firestore ID.
Only summary fields live here — the full contract body lives in the
`versions` subcollection below (see AGENTS.md decision 21 for why).

| Field | Type | Notes |
|---|---|---|
| `title` | `string \| null` | Denormalized from the current version's `contractData.title` |
| `agreementType` | `string` | One of `AgreementType` — `SERVICE`, `WORK`, `PAYMENT`, `RENTAL`, `CHANGE_ORDER`, `DELIVERY`, `BUSINESS`, `OTHER` |
| `parties` | `array<{name, role}>` | Denormalized from the current version |
| `status` | `string` | `DRAFT` → `READY_FOR_REVIEW` → `READY` → (Phase E: `AWAITING_APPROVAL` / `PARTIALLY_APPROVED` / `APPROVED` / `DECLINED` / `EXPIRED`, none of which are set by any code yet) |
| `currentVersion` | `number` | `0` = no content yet; see AGENTS.md decision 23 for the open question on whether this should start at 1 |
| `createdBy` | `string` | uid of the creator |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | Bumped on every version-creating write |
| `finalizedAt` | `Timestamp \| null` | Set once, by `/finalize` |

## `companies/{companyId}/agreements/{agreementId}/versions/{versionNumber}`

Doc ID is the version number itself as a string (`"1"`, `"2"`, ...) —
not auto-generated — specifically so "fetch the current version" is a
direct `.doc(String(n)).get()` instead of a query. Immutable once
written; a new version is a new doc, never an update to an old one.

| Field | Type | Notes |
|---|---|---|
| `versionNumber` | `number` | Matches the doc ID |
| `contractData` | `object` | Full contract body — see shape below |
| `source` | `string` | `AI_DRAFT` \| `USER_EDITED` \| `FINALIZED` (the last is defined but currently unused — see AGENTS.md decision 22) |
| `createdAt` | `Timestamp` | |
| `createdBy` | `string` | uid of whoever triggered this version |
| `aiPromptVersion` | `string \| null` | Set only on `AI_DRAFT` versions; matches `AGREEMENT_EXTRACTION_PROMPT_VERSION` at the time |

`contractData` shape (matches `contractDataSchema` in
`modules/agreements/schema.ts` exactly — that file is the real source
of truth for validation, this is just the reference):

| Field | Type |
|---|---|
| `title` | `string \| null` |
| `agreementType` | `AgreementType` |
| `parties` | `array<{name: string, role: string}>` |
| `scope` | `string[]` |
| `deliverables` | `string[]` |
| `payment` | `{totalAmount?: number, currency?: string, terms?: string} \| null` |
| `deadline` | `string \| null` |
| `responsibilities` | `array<{party: string, responsibility: string}>` |
| `conditions` | `string[]` |
| `notes` | `string[]` |
| `missingInformation` | `string[]` |

## `companies/{companyId}/agreements/{agreementId}/events/{eventId}`

Append-only audit log (spec section 29). Doc ID auto-generated, never
updated or deleted.

| Field | Type | Notes |
|---|---|---|
| `type` | `string` | `AGREEMENT_CREATED` \| `TRANSCRIPT_RECEIVED` \| `AI_DRAFT_CREATED` \| `DRAFT_EDITED` \| `AGREEMENT_FINALIZED` today; `PDF_CREATED` / `SHARE_INITIATED` / `SIGNING_SESSION_CREATED` / `PARTY_VIEWED` / `PARTY_APPROVED` / `PARTY_DECLINED` reserved for Phase E |
| `actorId` | `string` | uid (or, once Phase E lands, a party identifier for customer-triggered events) |
| `metadata` | `object` | Free-form, event-specific (e.g. `{versionNumber}` on `DRAFT_EDITED`) |
| `timestamp` | `Timestamp` | |

## `subscriptions/{uid}` — Phase F, not created by any code yet

Planned shape, not yet implemented. Will be the *only* thing the
RevenueCat webhook writes — never trust a client-supplied plan/status
(spec section 30).

| Field | Type | Notes |
|---|---|---|
| `plan` | `string` | Entitlement tier from RevenueCat |
| `status` | `string` | Active/expired/etc. |
| `updatedAt` | `Timestamp` | |
