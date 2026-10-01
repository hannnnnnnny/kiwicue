import { expect, it } from "vitest";
import { priceEvidence } from "../lib/ask/price-evidence";
import { EMPTY_FILTERS } from "../lib/ask/schema";

it("party 1 at 20 with total ceiling 20", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 1, totalBudget: 20 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });

it("party 2 at 20 with total ceiling 40", () => { const result = priceEvidence({ min: 20, max: 20, free: false }, { ...EMPTY_FILTERS, partySize: 2, totalBudget: 40 }); expect(result.keep).toBe(true); expect(result.budgetStatus).toBe("estimate"); });
