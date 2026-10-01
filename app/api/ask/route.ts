import { defaultSources } from "../../../lib/ask/candidates";
import { deepseekConverse } from "../../../lib/ask/converse";
import { isAskConfigured } from "../../../lib/ask/config";
import { identifyAsker } from "../../../lib/ask/identify";
import { jevEvaluate } from "../../../lib/ask/jev";
import { tmdbMediaLookup } from "../../../lib/ask/media";
import { handleAsk } from "../../../lib/ask/pipeline";
import { createSupabaseQuotaStore } from "../../../lib/ask/quota";

// Deciding, searching (understand, rank) and the streamed reply stay well inside this.
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  return handleAsk(request, {
    configured: isAskConfigured(),
    quota: createSupabaseQuotaStore(),
    identify: identifyAsker,
    evaluate: jevEvaluate,
    converse: deepseekConverse,
    sources: defaultSources,
    media: tmdbMediaLookup,
    now: () => new Date(),
  });
}
