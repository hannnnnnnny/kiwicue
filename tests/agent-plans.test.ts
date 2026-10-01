import { expect, it } from "vitest";
import { readPlans, createPlan, planCosts, planWarnings } from "../lib/ask/plans";
import { EMPTY_FILTERS } from "../lib/ask/schema";
const card = { kind: "movie" as const, id: "m1", title: "A film", when: "2026-10-03T08:00:00Z", venue: "Albany", href: "/movies?q=A", imageUrl: null, priceText: null, sessionCount: 1, score: 1, durationMinutes: 100, budgetStatus: "unknown" as const, minPartyCost: null };
const plan = { id: "test-plan", name: "Saturday", createdAt: "2026-10-01T06:00:00Z", filters: EMPTY_FILTERS, cards: [card], notes: "" };


it("round trip a validated local plan", () => { expect(readPlans(JSON.stringify([plan]))).toEqual([plan]); });

it("safely read empty or invalid storage null", () => { expect(readPlans(null)).toEqual([]); });

it("safely read empty or invalid storage \"not json\"", () => { expect(readPlans("not json")).toEqual([]); });

it("safely read empty or invalid storage \"{}\"", () => { expect(readPlans("{}")).toEqual([]); });

it("safely read empty or invalid storage \"[]\"", () => { expect(readPlans("[]")).toEqual([]); });

it("safely read empty or invalid storage \"[null]\"", () => { expect(readPlans("[null]")).toEqual([]); });

it("reject persisted invalid plan name", () => { expect(readPlans(JSON.stringify([{ ...plan, name: "" }]))).toEqual([]); });

it("reject persisted invalid plan createdAt", () => { expect(readPlans(JSON.stringify([{ ...plan, createdAt: "not a date" }]))).toEqual([]); });

it("reject persisted invalid plan id", () => { expect(readPlans(JSON.stringify([{ ...plan, id: "../unsafe" }]))).toEqual([]); });

it("reject persisted invalid plan cards", () => { expect(readPlans(JSON.stringify([{ ...plan, cards: [] }]))).toEqual([]); });

it("reject persisted invalid plan notes", () => { expect(readPlans(JSON.stringify([{ ...plan, notes: "x".repeat(1001) }]))).toEqual([]); });

it("bound stored plan payload before decoding", () => { expect(readPlans(" ".repeat(250001))).toEqual([]); });

it("reject too many saved plans instead of truncating silently", () => { expect(readPlans(JSON.stringify(Array(21).fill(plan)))).toEqual([]); });

it("deduplicate explicitly selected cards", () => { expect(createPlan([card, card], EMPTY_FILTERS, "Weekend").cards).toHaveLength(1); });

it("strip an untrusted booking URL when creating a plan", () => { expect(createPlan([{ ...card, bookingUrl: "https://evil.example" }], EMPTY_FILTERS, "Weekend").cards[0].bookingUrl).toBeNull(); });

it("warn when known movie runtimes overlap", () => { expect(planWarnings([card, { ...card, id: "m2", when: "2026-10-03T09:00:00Z" }])).toContain("overlap"); });

it("allow back to back known durations without false overlap", () => { expect(planWarnings([card, { ...card, id: "m2", when: "2026-10-03T09:40:00Z" }])).not.toContain("overlap"); });

it("keep unknown duration distinct from a verified schedule", () => { expect(planWarnings([{ ...card, durationMinutes: null }])).toContain("duration"); });

it("warn that moving venues needs transport verification", () => { expect(planWarnings([card, { ...card, id: "m2", venue: "Newmarket", when: "2026-10-03T11:00:00Z" }])).toContain("travel"); });

it("sum all selected activities rather than checking each budget separately", () => { expect(planCosts({ ...plan, filters: { ...EMPTY_FILTERS, totalBudget: 60 }, cards: [{ ...card, minPartyCost: 40 }, { ...card, id: "m2", minPartyCost: 30 }] })).toMatchObject({ minimum: 70, exceeds: true, unknown: false }); });
