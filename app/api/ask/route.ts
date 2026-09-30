import { defaultSources } from "../../../lib/ask/candidates";
import { isAskConfigured } from "../../../lib/ask/config";
import { identifyAsker } from "../../../lib/ask/identify";
import { jevEvaluate } from "../../../lib/ask/jev";
import { handleAsk } from "../../../lib/ask/pipeline";
import { createSupabaseQuotaStore } from "../../../lib/ask/quota";
import { deepseekStreamReply } from "../../../lib/ask/reply";
import { deepseekGenerateSlots } from "../../../lib/ask/understand-deepseek";

// Understanding, ranking and the streamed reply together stay well inside this.
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  return handleAsk(request, {
    configured: isAskConfigured(),
    quota: createSupabaseQuotaStore(),
    identify: identifyAsker,
    evaluate: jevEvaluate,
    generateSlots: deepseekGenerateSlots,
    streamReply: deepseekStreamReply,
    sources: defaultSources,
    now: () => new Date(),
  });
}
