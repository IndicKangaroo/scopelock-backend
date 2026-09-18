import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { ApiError } from "../../utils/apiError";
import type { ExtractionResult } from "../ai/service";
import type { CreateAgreementInput, UpdateAgreementInput } from "./schema";
import { AgreementType, type Agreement, type AgreementStatus, type AgreementWithContract, type ContractData } from "./types";

function agreementsCollection(companyId: string) {
  return db.collection("companies").doc(companyId).collection("agreements");
}
function versionsCollection(companyId: string, agreementId: string) {
  return agreementsCollection(companyId).doc(agreementId).collection("versions");
}
function eventsCollection(companyId: string, agreementId: string) {
  return agreementsCollection(companyId).doc(agreementId).collection("events");
}

/**
 * Firestore Timestamps have .toDate(); our test double stores plain
 * epoch numbers instead. Duck-type instead of `instanceof Timestamp`
 * so both work without mocking the firestore Timestamp class itself.
 */
function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") return value;
  return null;
}

const emptyContract = (title: string | null, agreementType: AgreementType, parties: ContractData["parties"]): ContractData => ({
  title,
  agreementType,
  parties,
  scope: [],
  deliverables: [],
  payment: null,
  deadline: null,
  responsibilities: [],
  conditions: [],
  notes: [],
  missingInformation: [],
});

function serializeAgreement(id: string, data: FirebaseFirestore.DocumentData): Agreement {
  return {
    id,
    title: data.title ?? null,
    agreementType: (data.agreementType as AgreementType) ?? AgreementType.OTHER,
    parties: data.parties ?? [],
    status: (data.status as AgreementStatus) ?? "DRAFT",
    currentVersion: data.currentVersion ?? 0,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    finalizedAt: toIso(data.finalizedAt),
  };
}

export async function listAgreements(companyId: string, limit: number): Promise<Agreement[]> {
  const snap = await agreementsCollection(companyId).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => serializeAgreement(doc.id, doc.data()));
}

export async function createAgreement(
  companyId: string,
  uid: string,
  input: CreateAgreementInput,
): Promise<Agreement> {
  const ref = agreementsCollection(companyId).doc();
  const now = FieldValue.serverTimestamp();

  await ref.set({
    title: input.title ?? null,
    agreementType: input.agreementType,
    parties: [],
    status: "DRAFT",
    currentVersion: 0, // no contract content yet — see AGENTS.md "open decisions" for why 0, not the spec example's 1
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
  });

  await recordEvent(companyId, ref.id, "AGREEMENT_CREATED", uid);

  const snap = await ref.get();
  return serializeAgreement(ref.id, snap.data()!);
}

async function fetchAgreementOrThrow(companyId: string, id: string): Promise<FirebaseFirestore.DocumentSnapshot> {
  const snap = await agreementsCollection(companyId).doc(id).get();
  if (!snap.exists) {
    throw ApiError.agreementNotFound();
  }
  return snap;
}

async function currentContract(companyId: string, id: string, agreement: Agreement): Promise<ContractData> {
  if (agreement.currentVersion === 0) {
    return emptyContract(agreement.title, agreement.agreementType, agreement.parties);
  }
  const versionSnap = await versionsCollection(companyId, id).doc(String(agreement.currentVersion)).get();
  if (!versionSnap.exists) {
    // Shouldn't happen outside test/data corruption, but degrade gracefully rather than 500.
    return emptyContract(agreement.title, agreement.agreementType, agreement.parties);
  }
  return versionSnap.data()!.contractData as ContractData;
}

export async function getAgreement(companyId: string, id: string): Promise<AgreementWithContract> {
  const snap = await fetchAgreementOrThrow(companyId, id);
  const agreement = serializeAgreement(snap.id, snap.data()!);
  const contract = await currentContract(companyId, id, agreement);
  return { ...agreement, contract };
}

export async function updateAgreement(
  companyId: string,
  id: string,
  patch: UpdateAgreementInput,
  actorUid: string,
): Promise<AgreementWithContract> {
  const snap = await fetchAgreementOrThrow(companyId, id);
  const agreement = serializeAgreement(snap.id, snap.data()!);
  const existingContract = await currentContract(companyId, id, agreement);

  const nextContract: ContractData = { ...existingContract, ...patch };
  const nextVersionNumber = agreement.currentVersion + 1;
  const now = FieldValue.serverTimestamp();

  await versionsCollection(companyId, id).doc(String(nextVersionNumber)).set({
    versionNumber: nextVersionNumber,
    contractData: nextContract,
    source: "USER_EDITED",
    createdAt: now,
    createdBy: actorUid,
    aiPromptVersion: null,
  });

  await agreementsCollection(companyId).doc(id).update({
    title: nextContract.title,
    agreementType: nextContract.agreementType,
    parties: nextContract.parties,
    currentVersion: nextVersionNumber,
    updatedAt: now,
  });

  await recordEvent(companyId, id, "DRAFT_EDITED", actorUid, { versionNumber: nextVersionNumber });

  const updatedSnap = await agreementsCollection(companyId).doc(id).get();
  return { ...serializeAgreement(id, updatedSnap.data()!), contract: nextContract };
}

/**
 * Stores the AI's extracted contract as a new version and moves the
 * agreement to READY_FOR_REVIEW. Called by the /process route after
 * ai/service.ts has already parsed + schema-validated the AI output —
 * this function assumes `extraction.contract` is trustworthy.
 */
export async function applyAiExtraction(
  companyId: string,
  id: string,
  extraction: ExtractionResult,
  actorUid: string,
): Promise<AgreementWithContract> {
  await fetchAgreementOrThrow(companyId, id);
  const agreementSnap = await agreementsCollection(companyId).doc(id).get();
  const agreement = serializeAgreement(id, agreementSnap.data()!);

  const nextVersionNumber = agreement.currentVersion + 1;
  const now = FieldValue.serverTimestamp();

  await versionsCollection(companyId, id).doc(String(nextVersionNumber)).set({
    versionNumber: nextVersionNumber,
    contractData: extraction.contract,
    source: "AI_DRAFT",
    createdAt: now,
    createdBy: actorUid,
    aiPromptVersion: extraction.promptVersion,
  });

  await agreementsCollection(companyId).doc(id).update({
    title: extraction.contract.title,
    agreementType: extraction.contract.agreementType,
    parties: extraction.contract.parties,
    status: "READY_FOR_REVIEW" satisfies AgreementStatus,
    currentVersion: nextVersionNumber,
    updatedAt: now,
  });

  await recordEvent(companyId, id, "AI_DRAFT_CREATED", actorUid, { versionNumber: nextVersionNumber });

  const updatedSnap = await agreementsCollection(companyId).doc(id).get();
  return { ...serializeAgreement(id, updatedSnap.data()!), contract: extraction.contract };
}

/**
 * "Freeze current version" (spec section 21) — does not create a new
 * version, just locks in whatever the current one already is. See
 * AGENTS.md decision log for why finalize doesn't bump the version.
 */
export async function finalizeAgreement(companyId: string, id: string, actorUid: string): Promise<AgreementWithContract> {
  const snap = await fetchAgreementOrThrow(companyId, id);
  const agreement = serializeAgreement(snap.id, snap.data()!);

  if (agreement.status === "READY") {
    // Idempotent: finalizing an already-finalized agreement just returns it.
    const contract = await currentContract(companyId, id, agreement);
    return { ...agreement, contract };
  }

  if (agreement.currentVersion === 0 || !agreement.title) {
    throw ApiError.stateConflict("Agreement has no content to finalize yet — process a transcript or fill it in first");
  }

  const now = FieldValue.serverTimestamp();
  await agreementsCollection(companyId).doc(id).update({
    status: "READY" satisfies AgreementStatus,
    finalizedAt: now,
    updatedAt: now,
  });

  await recordEvent(companyId, id, "AGREEMENT_FINALIZED", actorUid);

  const updatedSnap = await agreementsCollection(companyId).doc(id).get();
  const updated = serializeAgreement(id, updatedSnap.data()!);
  const contract = await currentContract(companyId, id, updated);
  return { ...updated, contract };
}

/** Append-only audit trail (spec section 29). */
export async function recordEvent(
  companyId: string,
  agreementId: string,
  type: string,
  actorId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await eventsCollection(companyId, agreementId).add({
    type,
    actorId,
    metadata,
    timestamp: FieldValue.serverTimestamp(),
  });
}
