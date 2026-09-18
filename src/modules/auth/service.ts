import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../config/firebase";

export interface UserRecord {
  uid: string;
  email: string | null;
  name: string | null;
  companyId: string;
}

/**
 * The only code path allowed to create a company for a user — call
 * this, don't hand-roll company creation elsewhere. Idempotent: on
 * repeat calls for a uid that already has a users/{uid} doc, just
 * returns it. On first call, creates companies/{companyId} (owner =
 * this uid, plan "free") and users/{uid} pointing at it, in one
 * batch so we never end up with one doc but not the other.
 */
export async function bootstrapUser(uid: string, email?: string | null): Promise<UserRecord> {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    const data = userSnap.data() ?? {};
    return {
      uid,
      email: data.email ?? null,
      name: data.name ?? null,
      companyId: data.companyId,
    };
  }

  const companyRef = db.collection("companies").doc();
  const now = FieldValue.serverTimestamp();
  const defaultCompanyName = email ? `${email.split("@")[0]}'s Company` : "My Company";

  const batch = db.batch();
  batch.set(companyRef, {
    name: defaultCompanyName,
    ownerUid: uid,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });
  batch.set(userRef, {
    name: null,
    email: email ?? null,
    companyId: companyRef.id,
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();

  return { uid, email: email ?? null, name: null, companyId: companyRef.id };
}
