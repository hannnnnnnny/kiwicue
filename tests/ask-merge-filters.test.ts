import { describe, expect, it } from "vitest";
import { mergeFilters } from "../lib/ask/merge-filters";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const NOW = new Date("2026-09-30T23:00:00Z"); // Thu 1 Oct, noon Auckland

describe("mergeFilters", () => {
  it("builds fresh filters from both sources", () => {
    const filters = mergeFilters({
      previous: null, now: NOW,
      jev: { domain: "events", when: "weekend", category: "family", kids: "on" },
      deepseek: { names: [], place: "Botany", dates: [], mode: "new" },
    });
    expect(filters).toEqual({ ...EMPTY_FILTERS, domain: "events", dates: ["2026-10-03", "2026-10-04"], category: "family", kids: true, place: "Botany" });
  });

  it("refines: keeps unmentioned filters and overrides mentioned ones", () => {
    const previous = { ...EMPTY_FILTERS, domain: "events" as const, dates: ["2026-10-03"], kids: true, place: "Botany" };
    const filters = mergeFilters({ previous, now: NOW, jev: { timeOfDay: "evening" }, deepseek: { names: [], place: null, dates: [], mode: "refine" } });
    expect(filters).toEqual({ ...previous, timeOfDay: "evening" });
  });

  it("explicit dates from DeepSeek win over a vague when, and off toggles clear", () => {
    const previous = { ...EMPTY_FILTERS, kids: true, free: true };
    const filters = mergeFilters({ previous, now: NOW, jev: { when: "week", kids: "off" }, deepseek: { names: ["Cabaret"], place: null, dates: ["2026-10-02", "2025-01-01"], mode: "refine" } });
    expect(filters).toEqual({ ...EMPTY_FILTERS, dates: ["2026-10-02"], free: true, names: ["Cabaret"] });
  });

  it("a new question starts from empty filters", () => {
    const previous = { ...EMPTY_FILTERS, kids: true, area: "west" as const };
    expect(mergeFilters({ previous, now: NOW, jev: { domain: "movies" }, deepseek: { names: [], place: null, dates: [], mode: "new" } }))
      .toEqual({ ...EMPTY_FILTERS, domain: "movies" });
  });

  it("takes a budget from DeepSeek, keeps it on refinements and ignores nonsense amounts", () => {
    const slots = { names: [], place: null, dates: [], mode: "refine" as const };
    expect(mergeFilters({ previous: null, now: NOW, jev: null, deepseek: { ...slots, maxPrice: 29.6 } }).maxPrice).toBe(30);
    const previous = { ...EMPTY_FILTERS, maxPrice: 30 };
    expect(mergeFilters({ previous, now: NOW, jev: { timeOfDay: "evening" }, deepseek: { ...slots, maxPrice: null } }).maxPrice).toBe(30);
    expect(mergeFilters({ previous: null, now: NOW, jev: null, deepseek: { ...slots, maxPrice: 0 } }).maxPrice).toBeNull();
    expect(mergeFilters({ previous: null, now: NOW, jev: null, deepseek: { ...slots, maxPrice: 50_000 } }).maxPrice).toBeNull();
  });

  it("works when either source is missing", () => {
    const previous = { ...EMPTY_FILTERS, area: "west" as const };
    expect(mergeFilters({ previous, now: NOW, jev: null, deepseek: null })).toEqual(previous);
    expect(mergeFilters({ previous: null, now: NOW, jev: { free: "on" }, deepseek: null })).toEqual({ ...EMPTY_FILTERS, free: true });
  });
});
