import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { parseEventCategory, type EventCategory } from "./event-categories";

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 4096;
const MAX_RANGES = 32;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_ANCHOR_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type EventTimeRange = {
  start: string;
  end: string;
};

export type EventFeedCursorState = {
  anchor: string;
  category: EventCategory | null;
  totalElements: number;
  size: number;
  page: number;
  ranges: EventTimeRange[];
};

type CursorPayload = EventFeedCursorState & { v: typeof CURSOR_VERSION };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
}

function canonicalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    return null;
  }
  return date;
}

function parsePayload(value: unknown, now: Date): EventFeedCursorState | null {
  if (!isRecord(value)) return null;
  if (!hasExactKeys(value, [
    "v",
    "anchor",
    "category",
    "totalElements",
    "size",
    "page",
    "ranges",
  ])) return null;
  if (value.v !== CURSOR_VERSION) return null;

  const category = value.category === null
    ? null
    : parseEventCategory(typeof value.category === "string" ? value.category : null);
  if (value.category !== null && !category) return null;

  const anchor = canonicalDate(value.anchor);
  if (!anchor) return null;
  const age = now.getTime() - anchor.getTime();
  if (age > MAX_ANCHOR_AGE_MS || age < -MAX_CLOCK_SKEW_MS) return null;

  if (
    typeof value.totalElements !== "number" ||
    !Number.isSafeInteger(value.totalElements) ||
    value.totalElements < 0
  ) return null;
  if (
    typeof value.size !== "number" ||
    !Number.isInteger(value.size) ||
    value.size < 1 ||
    value.size > 50
  ) return null;
  if (
    typeof value.page !== "number" ||
    !Number.isInteger(value.page) ||
    value.page < 0 ||
    value.size * value.page >= 1000
  ) return null;
  if (
    !Array.isArray(value.ranges) ||
    value.ranges.length < 1 ||
    value.ranges.length > MAX_RANGES
  ) return null;

  const yearEnd = anchor.getTime() + YEAR_MS;
  const ranges: EventTimeRange[] = [];
  for (const candidate of value.ranges) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["start", "end"])) {
      return null;
    }
    const start = canonicalDate(candidate.start);
    const end = canonicalDate(candidate.end);
    if (
      !start ||
      !end ||
      start.getTime() < anchor.getTime() ||
      end.getTime() > yearEnd ||
      end.getTime() <= start.getTime()
    ) return null;
    ranges.push({ start: start.toISOString(), end: end.toISOString() });
  }

  return {
    anchor: anchor.toISOString(),
    category,
    totalElements: value.totalElements,
    size: value.size,
    page: value.page,
    ranges,
  };
}

function signatureFor(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function encodeEventFeedCursor(
  state: EventFeedCursorState,
  secret: string,
): string {
  if (!secret) throw new Error("Cursor signing secret is required");
  const payload: CursorPayload = { v: CURSOR_VERSION, ...state };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signatureFor(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function decodeEventFeedCursor(
  value: string,
  secret: string,
  now = new Date(),
): EventFeedCursorState | null {
  if (!value || !secret || value.length > MAX_CURSOR_LENGTH) return null;

  try {
    const parts = value.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [payload, signature] = parts;
    if (
      Buffer.from(payload, "base64url").toString("base64url") !== payload ||
      Buffer.from(signature, "base64url").toString("base64url") !== signature
    ) return null;

    const actualSignature = Buffer.from(signature, "base64url");
    const expectedSignature = signatureFor(payload, secret);
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) return null;

    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return parsePayload(decoded, now);
  } catch {
    return null;
  }
}
