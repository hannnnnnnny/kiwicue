import { z } from "zod";

export const ASK_DOMAINS = ["any", "events", "movies", "markets"] as const;
export const ASK_TIMES = ["any", "day", "evening"] as const;
export const ASK_AREAS = ["any", "north", "central", "east", "south", "west"] as const;
export const ASK_CATEGORIES = ["any", "music", "theatre", "family", "sports", "other"] as const;
export type AskDomain = (typeof ASK_DOMAINS)[number];
export type AskTime = (typeof ASK_TIMES)[number];
export type AskArea = (typeof ASK_AREAS)[number];
export type AskCategory = (typeof ASK_CATEGORIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const askFiltersSchema = z.object({
  domain: z.enum(ASK_DOMAINS),
  dates: z.array(isoDate).max(14),
  timeOfDay: z.enum(ASK_TIMES),
  area: z.enum(ASK_AREAS),
  category: z.enum(ASK_CATEGORIES),
  kids: z.boolean(),
  free: z.boolean(),
  names: z.array(z.string().trim().min(1).max(80)).max(5),
  place: z.string().trim().min(1).max(80).nullable(),
  /** Highest acceptable lowest ticket price in NZD. Defaults so filters from older clients still validate. */
  maxPrice: z.number().int().min(1).max(1000).nullable().default(null),
}).strict();
export type AskFilters = z.infer<typeof askFiltersSchema>;

export const EMPTY_FILTERS: AskFilters = {
  domain: "any", dates: [], timeOfDay: "any", area: "any", category: "any",
  kids: false, free: false, names: [], place: null, maxPrice: null,
};

export const askRequestSchema = z.object({
  text: z.string().trim().min(1).max(300),
  language: z.enum(["en", "zh"]),
  previous: askFiltersSchema.nullable(),
  history: z.array(z.string().trim().min(1).max(300)).max(5),
  /** Re-run with `previous` exactly as given, e.g. after a chip was removed. */
  refineOnly: z.boolean().default(false),
}).strict();
export type AskRequest = z.infer<typeof askRequestSchema>;

export const askCardSchema = z.object({
  kind: z.enum(["event", "movie", "market"]),
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  when: z.string().min(1).max(40),
  venue: z.string().max(200).nullable(),
  href: z.string().regex(/^\/(?!\/)/u).max(400),
  imageUrl: z.url({ protocol: /^https$/u }).max(2048).nullable(),
  priceText: z.string().max(60).nullable(),
  sessionCount: z.number().int().min(1),
  score: z.number().min(0).max(1),
  trailerKey: z.string().regex(/^[A-Za-z0-9_-]{11}$/u).nullable().optional(),
}).strict();
export type AskCard = z.infer<typeof askCardSchema>;

const chipSchema = z.object({
  key: z.string().regex(/^(domain|dates|timeOfDay|area|category|kids|free|place|maxPrice|name:[0-4])$/u),
  label: z.string().max(80),
});
export type AskChip = z.infer<typeof chipSchema>;
export type AskTier = "guest" | "free" | "plus";
export const ASK_ERROR_CODES = ["rate_limited", "quota_exhausted", "budget_exhausted", "invalid", "unavailable", "internal"] as const;
export type AskErrorCode = (typeof ASK_ERROR_CODES)[number];
export type AskNoticeCode = "ai_degraded" | "source_unavailable";

export const askStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("understood"), filters: askFiltersSchema, chips: z.array(chipSchema).max(12) }),
  z.object({ type: z.literal("result"), card: askCardSchema }),
  z.object({ type: z.literal("best"), id: z.string().max(200) }),
  z.object({
    type: z.literal("media"), id: z.string().max(200),
    imageUrl: z.url({ protocol: /^https$/u }).max(2048).startsWith("https://image.tmdb.org/").nullable(),
    trailerKey: z.string().regex(/^[A-Za-z0-9_-]{11}$/u).nullable(),
  }),
  z.object({ type: z.literal("relaxed"), keys: z.array(chipSchema.shape.key).max(8) }),
  z.object({ type: z.literal("reply"), delta: z.string().max(400) }),
  z.object({ type: z.literal("notice"), code: z.enum(["ai_degraded", "source_unavailable"]), message: z.string().max(200) }),
  z.object({ type: z.literal("done"), remaining: z.number().int().min(0), tier: z.enum(["guest", "free", "plus"]) }),
  z.object({ type: z.literal("error"), code: z.enum(ASK_ERROR_CODES), message: z.string().max(200) }),
]);
export type AskStreamEvent = z.infer<typeof askStreamEventSchema>;
