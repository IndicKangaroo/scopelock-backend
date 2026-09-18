# Firebase Setup Checklist

None of this can be done from a codebase — it's console clicks tied to
your Google account. This is the full list, in order, to get from
"no Firebase project" to "backend and Android both working."

## 1. Create the project

1. [Firebase console](https://console.firebase.google.com/) → **Add project**.
2. Name it (this doesn't have to match the final app/package name).
3. Google Analytics is optional — skip it unless you already know you want it.

## 2. Register the Android app

1. Project settings → **Add app** → Android.
2. Enter the package name (spec section 19's open decision — finalize
   this before registering, changing it later means re-registering).
3. Download `google-services.json` → hand it to the Android dev, it
   goes in `android/app/`. The backend never touches this file.

## 3. Enable Authentication

1. Build → **Authentication** → Get started.
2. Enable whichever sign-in method(s) the Android app will use — at minimum
   pick one (Google Sign-In is the least friction for a hackathon demo;
   Email/Password if you want something that works without Play Services).
3. Nothing else needed here — the backend only ever *verifies* tokens
   Android already obtained (`middleware/auth.ts`), it never issues them.

## 4. Create the Firestore database

1. Build → **Firestore Database** → Create database.
2. **Native mode**, not Datastore mode.
3. Pick a region close to wherever the backend will be hosted (same
   region = lower latency between the two).
4. Start in **production mode** — the repo's `firestore.rules` already
   defaults to deny-all, which is correct here since only the backend's
   Admin SDK touches Firestore (Admin SDK bypasses these rules
   entirely; they're a safety net, not the real access control).
5. Deploy the repo's rules/indexes once you have the Firebase CLI set
   up: `firebase deploy --only firestore:rules,firestore:indexes`
   (needs `firebase login` + `firebase use <project-id>` first, or an
   `.firebaserc` pinning the project).

## 5. Generate the backend's service account

1. Project settings → **Service accounts** → Generate new private key.
2. This downloads a JSON file with `project_id`, `client_email`, `private_key`.
3. Map those three into the backend's `.env`:
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key`, with real newlines converted
     to literal `\n` (see the comment in `.env.example` — `firebase.ts`
     converts them back on load)
4. **Never commit this JSON file or paste its contents into `.env` in a
   place that gets committed.** `.env` is gitignored already; keep it
   that way.

## 6. Point the backend at it

```bash
cd backend
cp .env.example .env
# fill in FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
# from step 5, and OPENAI_API_KEY for the extraction endpoint
npm install
npm run dev
```

`GET /health` works immediately (no Firebase needed). `GET /v1/me`
and everything under `/v1/agreements` need a real Firebase ID token —
get one from the Android app once it's signed in (or via the Firebase
Auth REST API / a quick throwaway script using the Firebase client SDK
if you want to test before Android is ready).

## What's already handled in code

- Token verification: `middleware/auth.ts`
- User/company bootstrap on first authenticated call: `modules/auth/service.ts`
- Firestore collections this backend reads/writes: see `firestore-schema.md`
- Security rules / indexes: `firestore.rules`, `firestore.indexes.json` (repo root)
