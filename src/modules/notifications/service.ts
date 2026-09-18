/**
 * Phase G (spec section 35) — later. OneSignal triggers for workflow
 * events (share initiated, party viewed/approved/declined, per the
 * audit event vocabulary in spec section 29). Invoked from the
 * relevant agreements/signing handlers once Phase E/F land — not its
 * own route. Use for direct workflow value only, avoid notification
 * spam.
 *
 * TODO: call the OneSignal REST API with ONESIGNAL_APP_ID /
 * ONESIGNAL_REST_API_KEY for each event below.
 */

export type NotificationEvent =
  | "SIGNING_SESSION_CREATED"
  | "PARTY_VIEWED"
  | "PARTY_APPROVED"
  | "PARTY_DECLINED";

export async function sendNotification(_event: NotificationEvent, _payload: Record<string, unknown>): Promise<void> {
  throw new Error("not implemented — see TODO in notifications/service.ts");
}
