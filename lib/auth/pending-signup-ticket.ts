import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const PENDING_SIGNUP_TTL_MS = 15 * 60_000;
export const PENDING_SIGNUP_COOKIE = "kiwicue_pending_signup";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update("kiwicue-pending-signup-v1:").update(payload).digest();
}

export function createPendingSignupTicket(userId: string, secret: string, now = Date.now()): string {
  if (!uuidPattern.test(userId) || secret.length < 32) throw new Error("Invalid pending signup ticket input");
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: now }), "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function readPendingSignupTicket(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || token.length > 512 || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, digest] = parts;
  const received = Buffer.from(digest, "base64url");
  const expected = signature(payload, secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!value || typeof value !== "object" || !("userId" in value) || !("issuedAt" in value)) return null;
    const { userId, issuedAt } = value;
    if (typeof userId !== "string" || !uuidPattern.test(userId) || typeof issuedAt !== "number") return null;
    return now >= issuedAt && now - issuedAt <= PENDING_SIGNUP_TTL_MS ? userId : null;
  } catch { return null; }
}
