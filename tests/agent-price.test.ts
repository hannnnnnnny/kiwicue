import { expect, it } from "vitest";
import { priceEvidence } from "../lib/ask/price-evidence";
import { EMPTY_FILTERS } from "../lib/ask/schema";

it("party 1 at 20 with total ceiling 20", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 1, totalBudget: 20 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 2 at 20 with total ceiling 40", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 2, totalBudget: 40 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 3 at 20 with total ceiling 60", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 3, totalBudget: 60 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 3 at 20.01 with total ceiling 60", () => { const result = priceEvidence({ min: 20.01, max: 20.01, free: false }, { ...EMPTY_FILTERS, partySize: 3, totalBudget: 60 }); expect(result.keep).toBe(false); expect(result.budgetStatus).toBe("estimate"); });

it("party 3 at 19.99 with total ceiling 60", () => { const result = priceEvidence({ min: 19.99, max: 19.99, free: false }, { ...EMPTY_FILTERS, partySize: 3, totalBudget: 60 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 4 at 20 with total ceiling 60", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 4, totalBudget: 60 }); expect(result.keep).toBe(false); expect(result.budgetStatus).toBe("estimate"); });

it("party 1 at 0 with total ceiling 0", () => { const result = priceEvidence({ min: 0, max: 0, free: false }, { ...EMPTY_FILTERS, partySize: 1, totalBudget: 0 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 5 at 0 with total ceiling 0", () => { const result = priceEvidence({ min: 0, max: 0, free: false }, { ...EMPTY_FILTERS, partySize: 5, totalBudget: 0 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });
