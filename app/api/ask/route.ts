import { defaultSources } from "../../../lib/ask/candidates";
import { isAskConfigured } from "../../../lib/ask/config";
import { jevEvaluate } from "../../../lib/ask/jev";
import { handleAsk } from "../../../lib/ask/pipeline";
import { clientIp, createSupabaseQuotaStore, hashSubject } from "../../../lib/ask/quota";
import { deepseekStreamReply } from "../../../lib/ask/reply";
import type { AskTier } from "../../../lib/ask/schema";
import { deepseekGenerateSlots } from "../../../lib/ask/understand-deepseek";
import { verifiedUser } from "../../../lib/supabase/server";

// Understanding, ranking and the streamed reply together stay well inside this.
export const maxDuration = 30;

async function identify(request: Request): Promise<{ subject: string; tier: AskTier; userId: string | null }> {
  const { user } = await verifiedUser();
  if (user) return { subject: `user:${user.id}`, tier: "free", userId: user.id };
  return { subject: `ip:${hashSubject(clientIp(request.headers), process.env.ASK_HASH_SALT ?? "")}`, tier: "guest", userId: null };
}

export async function POST(request: Request): Promise<Response> {
  return handleAsk(request, {
    configured: isAskConfigured(),
    quota: createSupabaseQuotaStore(),
    identify,
    evaluate: jevEvaluate,
    generateSlots: deepseekGenerateSlots,
    streamReply: deepseekStreamReply,
    sources: defaultSources,
    now: () => new Date(),
  });
}
