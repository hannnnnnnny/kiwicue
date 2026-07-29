import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decodeEventFeedCursor,
  encodeEventFeedCursor,
  type EventFeedCursorState,
} from "../lib/event-feed-cursor";

const now = new Date("2026-07-29T00:00:00.000Z");
const secret = "test-key";
const state: EventFeedCursorState = {
  anchor: now.toISOString(),
  category: null,
  totalElements: 1201,
  size: 50,
  page: 1,
  ranges: [
    {
      start: now.toISOString(),
      end: "2026-10-29T06:00:00.000Z",
    },
  ],
};

function rawCursor(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

describe("event feed cursor", () => {
  it("round-trips a valid server cursor", () => {
    expect(decodeEventFeedCursor(encodeEventFeedCursor(state, secret), secret, now)).toEqual(
      state,
    );
  });

  it("rejects a cursor whose signed payload has been changed", () => {
    const cursor = encodeEventFeedCursor(state, secret);
    const [payload, signature] = cursor.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.totalElements = 999999;
    const tamperedPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");

    expect(decodeEventFeedCursor(`${tamperedPayload}.${signature}`, secret, now)).toBeNull();
  });

  it("rejects a cursor signed with a different server secret", () => {
    const cursor = encodeEventFeedCursor(state, "other-key");

    expect(decodeEventFeedCursor(cursor, secret, now)).toBeNull();
  });

  it.each(["", "not-base64", "e30", "a".repeat(4097)])(
    "rejects malformed cursor input",
    (value) => {
      expect(decodeEventFeedCursor(value, secret, now)).toBeNull();
    },
  );

  it.each([
    { ...state, extra: true },
    { v: 1, anchor: state.anchor },
    { v: 2, ...state },
    { ...state, size: 0 },
    { ...state, size: 51 },
    { ...state, page: 1.5 },
    { ...state, page: 20 },
    { ...state, totalElements: -1 },
    { ...state, totalElements: 1.5 },
    { ...state, ranges: [] },
    {
      ...state,
      ranges: Array.from({ length: 33 }, () => state.ranges[0]),
    },
    {
      ...state,
      ranges: [{ start: "not-a-date", end: state.ranges[0].end }],
    },
    {
      ...state,
      ranges: [{ start: state.ranges[0].end, end: state.anchor }],
    },
    {
      ...state,
      ranges: [{ start: state.anchor, end: "2027-07-30T00:00:00.000Z" }],
    },
  ])("rejects an invalid cursor payload", (payload) => {
    expect(
      decodeEventFeedCursor(rawCursor({ v: 1, ...payload }), secret, now),
    ).toBeNull();
  });

  it("rejects a cursor anchored more than 24 hours ago", () => {
    const oldAnchor = "2026-07-27T23:59:59.000Z";
    expect(
      decodeEventFeedCursor(
        rawCursor({
          v: 1,
          ...state,
          anchor: oldAnchor,
          ranges: [
            { start: oldAnchor, end: "2026-08-01T00:00:00.000Z" },
          ],
        }),
        secret,
        now,
      ),
    ).toBeNull();
  });

  it("rejects a cursor anchored more than five minutes ahead", () => {
    const futureAnchor = "2026-07-29T00:05:01.000Z";
    expect(
      decodeEventFeedCursor(
        rawCursor({
          v: 1,
          ...state,
          anchor: futureAnchor,
          ranges: [
            { start: futureAnchor, end: "2026-08-01T00:00:00.000Z" },
          ],
        }),
        secret,
        now,
      ),
    ).toBeNull();
  });
});
