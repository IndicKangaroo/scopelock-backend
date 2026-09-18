/**
 * In-memory stand-in for the `db`/`auth` exports of src/config/firebase.
 * Implements only the subset of the Firestore API this codebase calls
 * (doc/collection/get/set/update/add/orderBy/limit/batch) and does not
 * model real Firestore semantics (indexes, security rules, true query
 * planning) — these are logic/wiring tests for our own code, not
 * integration tests of Firestore itself. See AGENTS.md.
 *
 * Used via vi.mock("../src/config/firebase", () => import(...)) in
 * test files — see agreements.test.ts / health.test.ts for the
 * pattern.
 */

type Doc = Record<string, unknown>;

function makeCollection() {
  const store = new Map<string, Doc>();
  const subcollectionsByDoc = new Map<string, Map<string, ReturnType<typeof makeCollection>>>();
  let autoId = 0;

  function makeDocRef(id: string) {
    if (!subcollectionsByDoc.has(id)) subcollectionsByDoc.set(id, new Map());
    return {
      id,
      get: async () => ({
        id,
        exists: store.has(id),
        data: () => store.get(id),
      }),
      set: async (data: Doc) => {
        store.set(id, { ...data });
      },
      update: async (data: Doc) => {
        store.set(id, { ...(store.get(id) ?? {}), ...data });
      },
      collection: (name: string) => {
        const subs = subcollectionsByDoc.get(id)!;
        if (!subs.has(name)) subs.set(name, makeCollection());
        return subs.get(name)!;
      },
    };
  }

  return {
    doc: (id?: string) => makeDocRef(id ?? `auto_${++autoId}`),
    add: async (data: Doc) => {
      const ref = makeDocRef(`auto_${++autoId}`);
      await ref.set(data);
      return ref;
    },
    orderBy: () => ({
      limit: (n: number) => ({
        get: async () => {
          const entries = [...store.entries()].slice(0, n);
          return { docs: entries.map(([id, data]) => ({ id, exists: true, data: () => data })) };
        },
      }),
    }),
  };
}

export function createFakeFirebase() {
  const collectionsByName = new Map<string, ReturnType<typeof makeCollection>>();
  const db = {
    collection: (name: string) => {
      if (!collectionsByName.has(name)) collectionsByName.set(name, makeCollection());
      return collectionsByName.get(name)!;
    },
    batch: () => {
      type Op = () => Promise<void>;
      const ops: Op[] = [];
      return {
        set: (ref: { set: (d: Doc) => Promise<void> }, data: Doc) => ops.push(() => ref.set(data)),
        update: (ref: { update: (d: Doc) => Promise<void> }, data: Doc) => ops.push(() => ref.update(data)),
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  const knownTokens: Record<string, { uid: string; email: string }> = {
    "valid-token-a": { uid: "user_a", email: "a@example.com" },
    "valid-token-b": { uid: "user_b", email: "b@example.com" },
  };

  const auth = {
    verifyIdToken: async (token: string) => {
      const record = knownTokens[token];
      if (!record) throw new Error("invalid token");
      return record;
    },
  };

  return { auth, db, storage: {}, firebaseApp: {} };
}
