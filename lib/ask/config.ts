import "server-only";
import { readSupabasePublicConfig } from "../supabase/config";

const MIN_SALT_LENGTH = 16;

/** The mic button and /api/ask only switch on once every secret the feature needs is set. */
export function isAskConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(env.TYPESAFE_AI_API_KEY?.trim() && env.DEEPSEEK_API_KEY?.trim() && secret?.trim()
    && (env.ASK_HASH_SALT?.length ?? 0) >= MIN_SALT_LENGTH && readSupabasePublicConfig(env));
}
