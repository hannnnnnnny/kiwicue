import "server-only";
import { verifiedUser } from "../supabase/server";
import { clientIp, hashSubject } from "./quota";
import type { AskTier } from "./schema";

/** Signed-in visitors are counted by account; guests by a salted hash of their IP. */
export async function identifyAsker(request: Request): Promise<{ subject: string; tier: AskTier; userId: string | null }> {
  const { user } = await verifiedUser();
  if (user) return { subject: `user:${user.id}`, tier: "free", userId: user.id };
  return { subject: `ip:${hashSubject(clientIp(request.headers), process.env.ASK_HASH_SALT ?? "")}`, tier: "guest", userId: null };
}
