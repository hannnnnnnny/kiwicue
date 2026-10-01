import { z } from "zod";
import { askCardSchema, askFiltersSchema, type AskCard, type AskFilters } from "./schema";
import { trustedBookingUrl } from "./booking";

const iso = z.string().datetime({ offset: true });
export const outingPlanSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/u),
  name: z.string().trim().min(1).max(100),
  createdAt: iso,
  filters: askFiltersSchema,
  cards: z.array(askCardSchema).min(1).max(12),
  notes: z.string().max(1000).default(""),
}).strict();
export type OutingPlan = z.infer<typeof outingPlanSchema>;
export const PLAN_STORAGE_KEY = "kiwicue-outing-plans-v1";
export const MAX_PLANS = 20;

export function readPlans(raw: string | null): OutingPlan[] {
  if (!raw || raw.length > 250000) return [];
  try {
    const parsed = z.array(outingPlanSchema).max(MAX_PLANS).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}

export function createPlan(cards: AskCard[], filters: AskFilters, name: string, now = new Date()): OutingPlan {
  const unique = [...new Map(cards.map((card) => [card.id, { ...card, bookingUrl: trustedBookingUrl(card.bookingUrl) }])).values()];
  return outingPlanSchema.parse({ id: crypto.randomUUID(), name, createdAt: now.toISOString(), filters,
    cards: unique.sort((a, b) => Date.parse(a.when) - Date.parse(b.when)), notes: "" });
}

export function planCosts(plan: OutingPlan) {
  const known = plan.cards.filter((card) => card.minPartyCost != null);
  const minimum = Math.round(known.reduce((sum, card) => sum + card.minPartyCost!, 0) * 100) / 100;
  return { minimum, unknown: known.length !== plan.cards.length,
    exceeds: plan.filters.totalBudget !== null && minimum > plan.filters.totalBudget,
    free: plan.cards.every((card) => card.budgetStatus === "free") };
}

export function planWarnings(cards: AskCard[]): Array<"overlap" | "duration" | "travel"> {
  const warnings = new Set<"overlap" | "duration" | "travel">();
  const ordered = [...cards].sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  ordered.forEach((card, index) => {
    if (!card.durationMinutes) warnings.add("duration");
    const next = ordered[index + 1];
    if (!next) return;
    if (card.venue !== next.venue || !card.venue) warnings.add("travel");
    if (card.durationMinutes && Date.parse(card.when) + card.durationMinutes * 60000 > Date.parse(next.when)) warnings.add("overlap");
  });
  return [...warnings];
}
