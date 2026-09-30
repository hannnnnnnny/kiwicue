import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readSupabasePublicConfig } from "../supabase/config";
import { logAskFailure } from "./log";
import type { AskTier } from "./schema";

export type QuotaDecision =
  | { allowed: true; usageId: string; remaining: number; degrade: boolean; tier: AskTier }
  | { allowed: false; reason: "rate_limited" | "quota_exhausted" | "budget_exhausted" | "unavailable"; remaining: number; tier: AskTier };
/** Searches use the free quota; chat turns have their own daily cap. Both share the budget. */
export type QuotaKind = "search" | "chat";
export type QuotaStore = {
  reserve(subject: string, tier: AskTier, userId: string | null, kind?: QuotaKind): Promise<QuotaDecision>;
  recordCost(usageId: string, costMicroUsd: number, degraded: boolean): Promise<void>;
};

type ReserveRow = { allowed: boolean; reason: string | null; usage_id: string | null; remaining: number; degrade: boolean };
type Denial = "rate_limited" | "quota_exhausted" | "budget_exhausted";
const DENIALS = new Set<string>(["rate_limited", "quota_exhausted", "budget_exhausted"]);

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return candidate.slice(0, 64);
}

/** Guests are counted by a salted hash so raw IP addresses are never stored. */
export function hashSubject(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function toDecision(row: ReserveRow | undefined, tier: AskTier): QuotaDecision {
  if (row?.allowed && row.usage_id) return { allowed: true, usageId: row.usage_id, remaining: row.remaining, degrade: row.degrade, tier };
  const reason = row?.reason && DENIALS.has(row.reason) ? row.reason as Denial : "unavailable";
  return { allowed: false, reason, remaining: row?.remaining ?? 0, tier };
}

export function createSupabaseQuotaStore(env: Record<string, string | undefined> = process.env): QuotaStore | null {
  const config = readSupabasePublicConfig(env);
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret) return null;
  const client = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async reserve(subject, tier, userId, kind = "search") {
      const { data, error } = await client.rpc("ask_reserve", { p_subject: subject, p_tier: tier, p_user: userId, p_kind: kind });
      if (error) { logAskFailure("quota", error); return toDecision(undefined, tier); }
      return toDecision((data as ReserveRow[] | null)?.[0], tier);
    },
    async recordCost(usageId, cost, degraded) {
      const { error } = await client.rpc("ask_record_cost", { p_usage_id: usageId, p_cost: cost, p_degraded: degraded });
      if (error) logAskFailure("quota", error);
    },
  };
}
