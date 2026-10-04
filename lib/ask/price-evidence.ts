import type { AskFilters } from "./schema";

export type PriceEvidence = { min: number | null; max: number | null; free: boolean };

/** A listed minimum is only a lower bound; never promise that three tickets cost that amount. */
export function priceEvidence(price: PriceEvidence, filters: AskFilters) {
  const min = price.free ? 0 : price.min;
  const valid = min !== null && Number.isFinite(min) && min >= 0;
  const minPartyCost = valid ? Math.round(min * filters.partySize * 100) / 100 : null;
  const exceedsTicket = valid && filters.maxPrice !== null && min > filters.maxPrice;
  const exceedsTotal = minPartyCost !== null && filters.totalBudget !== null && minPartyCost > filters.totalBudget;
  return {
    keep: (!filters.free || price.free) && !exceedsTicket && !exceedsTotal,
    budgetStatus: price.free ? "free" as const : valid ? "estimate" as const : "unknown" as const,
    minPartyCost,
  };
}
