import { z } from "zod";
import { ASSISTANT_IDS, DEFAULT_ASSISTANT } from "../assistants";
import { ASK_MOODS } from "./mood";
import { trustedBookingUrl } from "./booking";

export const ASK_DOMAINS = ["any", "events", "movies", "markets"] as const;
export const ASK_TIMES = ["any", "day", "morning", "afternoon", "evening"] as const;
export const ASK_AREAS = ["any", "north", "central", "east", "south", "west"] as const;
export const ASK_CATEGORIES = ["any", "music", "theatre", "family", "sports", "other"] as const;
export type AskDomain = (typeof ASK_DOMAINS)[number];
export type AskTime = (typeof ASK_TIMES)[number];
export type AskArea = (typeof ASK_AREAS)[number];
export type AskCategory = (typeof ASK_CATEGORIES)[number];
/** How results are laid out; the assistant picks one to suit what it found. */
export const ASK_LAYOUTS = ["spotlight", "timeline", "shelf", "grid"] as const;
export type AskLayout = (typeof ASK_LAYOUTS)[number];

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
  totalBudget: z.number().min(0).max(10000).nullable().default(null),
  partySize: z.number().int().min(1).max(30).default(1),
  startMinute: z.number().int().min(0).max(1439).nullable().default(null),
  endMinute: z.number().int().min(1).max(1440).nullable().default(null),
}).strict();
export type AskFilters = z.infer<typeof askFiltersSchema>;

export const EMPTY_FILTERS: AskFilters = {
  domain: "any", dates: [], timeOfDay: "any", area: "any", category: "any",
  kids: false, free: false, names: [], place: null, maxPrice: null,
  totalBudget: null, partySize: 1, startMinute: null, endMinute: null,
};

export const MAX_HISTORY = 12;
export const MAX_SHOWN = 8;
const chatTurnSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(1200) }).strict();
export type AskChatTurn = z.infer<typeof chatTurnSchema>;
/** A card the visitor can see now, so "the second one" can be answered without searching again. */
const shownSchema = z.object({
  kind: z.enum(["event", "movie", "market"]), title: z.string().max(300), when: z.string().max(40),
  venue: z.string().max(200).nullable(), price: z.string().max(60).nullable(),
  bookingUrl: z.string().max(2048).refine((value) => trustedBookingUrl(value) !== null).nullable().optional(),
  href: z.string().regex(/^\/(?!\/)/u).max(400).refine((value) => !/[\\\u0000-\u0020\u007f]/u.test(value)).optional(),
}).strict();
export type AskShown = z.infer<typeof shownSchema>;

export const askRequestSchema = z.object({
  text: z.string().trim().min(1).max(300),
  language: z.enum(["en", "zh"]),
  previous: askFiltersSchema.nullable(),
  /** The conversation so far, oldest first, without the latest message. */
  history: z.array(chatTurnSchema).max(MAX_HISTORY),
  shown: z.array(shownSchema).max(MAX_SHOWN).default([]),
  /** Re-run with `previous` exactly as given, e.g. after a chip was removed. */
  refineOnly: z.boolean().default(false),
  /** Which assistant is answering; it only changes the reply's tone. */
  assistant: z.enum(ASSISTANT_IDS).default(DEFAULT_ASSISTANT),
}).strict();
export type AskRequest = z.infer<typeof askRequestSchema>;

export const askCardSchema = z.object({
  kind: z.enum(["event", "movie", "market"]),
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  when: z.string().min(1).max(40),
  venue: z.string().max(200).nullable(),
  href: z.string().regex(/^\/(?!\/)/u).max(400).refine((value) => !/[\\\u0000-\u0020\u007f]/u.test(value)),
  imageUrl: z.url({ protocol: /^https$/u }).max(2048).nullable(),
  priceText: z.string().max(60).nullable(),
  sessionCount: z.number().int().min(1),
  score: z.number().min(0).max(1),
  trailerKey: z.string().regex(/^[A-Za-z0-9_-]{11}$/u).nullable().optional(),
  bookingUrl: z.string().max(2048).refine((value) => trustedBookingUrl(value) !== null).nullable().optional(),
  budgetStatus: z.enum(["free", "estimate", "unknown"]).optional(),
  minPartyCost: z.number().min(0).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  indoor: z.boolean().optional(),
}).strict();
export type AskCard = z.infer<typeof askCardSchema>;

const chipSchema = z.object({
  key: z.string().regex(/^(domain|dates|timeOfDay|area|category|kids|free|place|maxPrice|totalBudget|partySize|startMinute|endMinute|name:[0-4])$/u),
  label: z.string().max(80),
});
export type AskChip = z.infer<typeof chipSchema>;
export type AskTier = "guest" | "free" | "plus";
export const ASK_ERROR_CODES = ["rate_limited", "quota_exhausted", "budget_exhausted", "invalid", "unavailable", "internal"] as const;
export type AskErrorCode = (typeof ASK_ERROR_CODES)[number];
export type AskNoticeCode = "ai_degraded" | "source_unavailable";

export const askStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("understood"), filters: askFiltersSchema, chips: z.array(chipSchema).max(20) }),
  z.object({ type: z.literal("result"), card: askCardSchema }),
  z.object({ type: z.literal("best"), id: z.string().max(200) }),
  z.object({
    type: z.literal("media"), id: z.string().max(200),
    imageUrl: z.url({ protocol: /^https$/u }).max(2048).startsWith("https://image.tmdb.org/").nullable(),
    trailerKey: z.string().regex(/^[A-Za-z0-9_-]{11}$/u).nullable(),
  }),
  z.object({ type: z.literal("layout"), layout: z.enum(ASK_LAYOUTS) }),
  z.object({ type: z.literal("relaxed"), keys: z.array(chipSchema.shape.key).max(8) }),
  z.object({ type: z.literal("reply"), delta: z.string().max(400) }),
  z.object({ type: z.literal("mood"), mood: z.enum(ASK_MOODS) }),
  z.object({ type: z.literal("notice"), code: z.enum(["ai_degraded", "source_unavailable"]), message: z.string().max(200) }),
  z.object({ type: z.literal("done"), remaining: z.number().int().min(0), tier: z.enum(["guest", "free", "plus"]) }),
  z.object({ type: z.literal("error"), code: z.enum(ASK_ERROR_CODES), message: z.string().max(200) }),
]);
export type AskStreamEvent = z.infer<typeof askStreamEventSchema>;
