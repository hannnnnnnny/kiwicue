import "server-only";

/**
 * With email confirmation on, signing up an address that is already registered returns a
 * decoy user id instead of an error, so a pending-signup ticket can point at no real user.
 * Callers answer that case exactly like a genuine pending signup so responses never reveal
 * whether an email has an account.
 */
export function isUserNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, status } = error as { code?: unknown; status?: unknown };
  return code === "user_not_found" || status === 404;
}
