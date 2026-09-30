import { deepseekGenerateTurn } from "../../../../lib/ask/chat";
import { handleAskChat } from "../../../../lib/ask/chat-handler";
import { isAskConfigured } from "../../../../lib/ask/config";
import { identifyAsker } from "../../../../lib/ask/identify";
import { createSupabaseQuotaStore } from "../../../../lib/ask/quota";

export const maxDuration = 15;

export async function POST(request: Request): Promise<Response> {
  return handleAskChat(request, {
    configured: isAskConfigured(),
    quota: createSupabaseQuotaStore(),
    identify: identifyAsker,
    generateTurn: deepseekGenerateTurn,
    now: () => new Date(),
  });
}
