import { expect, it } from "vitest";
import { askFiltersSchema, askCardSchema, EMPTY_FILTERS } from "../lib/ask/schema";
const card = { kind: "movie" as const, id: "m1", title: "A film", when: "2026-10-03T08:00:00Z", venue: "Albany", href: "/movies?q=A", imageUrl: null, priceText: null, sessionCount: 1, score: 1, durationMinutes: 100, budgetStatus: "unknown" as const, minPartyCost: null };


it("reject invalid constraint partySize=0", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, partySize: 0 }).success).toBe(false); });

it("reject invalid constraint partySize=31", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, partySize: 31 }).success).toBe(false); });

it("reject invalid constraint partySize=1.5", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, partySize: 1.5 }).success).toBe(false); });

it("reject invalid constraint totalBudget=-1", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, totalBudget: -1 }).success).toBe(false); });

it("reject invalid constraint totalBudget=10001", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, totalBudget: 10001 }).success).toBe(false); });

it("reject invalid constraint startMinute=1440", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, startMinute: 1440 }).success).toBe(false); });

it("reject invalid constraint startMinute=-1", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, startMinute: -1 }).success).toBe(false); });

it("reject invalid constraint endMinute=0", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, endMinute: 0 }).success).toBe(false); });

it("reject invalid constraint endMinute=1441", () => { expect(askFiltersSchema.safeParse({ ...EMPTY_FILTERS, endMinute: 1441 }).success).toBe(false); });

it("reject unsafe internal result '//evil.example'", () => { expect(askCardSchema.safeParse({ ...card, href: "//evil.example" }).success).toBe(false); });

it("reject unsafe internal result '/\\\\evil.example'", () => { expect(askCardSchema.safeParse({ ...card, href: "/\\evil.example" }).success).toBe(false); });
