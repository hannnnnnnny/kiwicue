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
