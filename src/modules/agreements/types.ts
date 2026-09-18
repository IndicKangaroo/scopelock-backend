export enum AgreementType {
  SERVICE = "SERVICE",
  WORK = "WORK",
  PAYMENT = "PAYMENT",
  RENTAL = "RENTAL",
  CHANGE_ORDER = "CHANGE_ORDER",
  DELIVERY = "DELIVERY",
  BUSINESS = "BUSINESS",
  OTHER = "OTHER",
}

/**
 * Broader than "contractor/customer" on purpose (spec section 10) —
 * ScopeLock covers any two-or-more-party verbal agreement, not just
 * contracting work.
 */
export interface Party {
  name: string;
  role: string;
}

export interface PaymentDetails {
  totalAmount?: number;
  currency?: string;
  terms?: string;
}

export interface Responsibility {
  party: string;
  responsibility: string;
}

/**
 * The AI-extracted / user-edited contract body. Lives standalone
 * (this is what gets stored per-version) and is also denormalized
 * onto the parent Agreement doc's title/agreementType/parties for
 * cheap list-view reads (spec section 28).
 */
export interface ContractData {
  title: string | null;
  agreementType: AgreementType;
  parties: Party[];
  scope: string[];
  deliverables: string[];
  payment: PaymentDetails | null;
  deadline: string | null;
  responsibilities: Responsibility[];
  conditions: string[];
  notes: string[];
  /** Never fabricate — anything the transcript didn't cover goes here instead (spec section 13, rule 7). */
  missingInformation: string[];
}

/**
 * DRAFT → READY_FOR_REVIEW happens on a successful /process call.
 * READY_FOR_REVIEW → READY happens on /finalize.
 * AWAITING_APPROVAL / PARTIALLY_APPROVED / APPROVED / DECLINED /
 * EXPIRED are reserved for the signing phase (spec section 26) —
 * nothing in this codebase sets them yet.
 */
export type AgreementStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "READY"
  | "AWAITING_APPROVAL"
  | "PARTIALLY_APPROVED"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED";

export type VersionSource = "AI_DRAFT" | "USER_EDITED" | "FINALIZED";

export interface Agreement {
  id: string;
  title: string | null;
  agreementType: AgreementType;
  parties: Party[];
  status: AgreementStatus;
  currentVersion: number;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  finalizedAt: string | null;
}

export interface AgreementVersion {
  versionNumber: number;
  contractData: ContractData;
  source: VersionSource;
  createdAt: string | null;
  createdBy: string;
  aiPromptVersion: string | null;
}

/** What GET/POST/PATCH return: the Agreement meta plus its current contract body. */
export interface AgreementWithContract extends Agreement {
  contract: ContractData;
}
