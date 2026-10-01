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
