import { expect, it } from "vitest";
import { calendarText, foldCalendarLine, calendarInstant, planCalendar } from "../lib/ask/calendar";
import { EMPTY_FILTERS } from "../lib/ask/schema";
const card = { kind: "movie" as const, id: "m1", title: "A film", when: "2026-10-03T08:00:00Z", venue: "Albany", href: "/movies?q=A", imageUrl: null, priceText: null, sessionCount: 1, score: 1, durationMinutes: 100, budgetStatus: "unknown" as const, minPartyCost: null };
const plan = { id: "test-plan", name: "Saturday", createdAt: "2026-10-01T06:00:00Z", filters: EMPTY_FILTERS, cards: [card], notes: "" };


it("escape calendar text 'a,b'", () => { expect(calendarText("a,b")).toBe("a\\,b"); });

it("escape calendar text 'a;b'", () => { expect(calendarText("a;b")).toBe("a\\;b"); });

it("escape calendar text 'a\\nb'", () => { expect(calendarText("a\nb")).toBe("a\\nb"); });

it("escape calendar text 'a\\r\\nb'", () => { expect(calendarText("a\r\nb")).toBe("a\\nb"); });

it("escape calendar text 'a\\\\b'", () => { expect(calendarText("a\\b")).toBe("a\\\\b"); });

it("fold UTF8 calendar line ASCII", () => { const folded = foldCalendarLine("SUMMARY:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); expect(folded.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true); expect(folded.replace(/\r\n /gu, "")).toBe("SUMMARY:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); });

it("fold UTF8 calendar line Chinese", () => { const folded = foldCalendarLine("SUMMARY:\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587"); expect(folded.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true); expect(folded.replace(/\r\n /gu, "")).toBe("SUMMARY:\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587\u4e2d\u6587"); });

it("fold UTF8 calendar line emoji", () => { const folded = foldCalendarLine("SUMMARY:\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d"); expect(folded.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true); expect(folded.replace(/\r\n /gu, "")).toBe("SUMMARY:\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d\ud83e\udd5d"); });

it("normalize calendar instant 2026-10-03T08:00:00Z", () => { expect(calendarInstant("2026-10-03T08:00:00Z")).toBe("20261003T080000Z"); });

it("normalize calendar instant 2026-10-03T21:00:00", () => { expect(calendarInstant("2026-10-03T21:00:00")).toBe("20261003T080000Z"); });

it("normalize calendar instant 2026-06-03T21:00:00", () => { expect(calendarInstant("2026-06-03T21:00:00")).toBe("20260603T090000Z"); });

it("normalize calendar instant bad", () => { expect(calendarInstant("bad")).toBe(null); });
