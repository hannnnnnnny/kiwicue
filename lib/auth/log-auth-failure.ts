import "server-only";

export type AuthFailureStep = "signup" | "admin-lookup" | "resend";

const EMAIL_PATTERN = /[^\s"'<>@]+@[^\s"'<>@]+/g;

function field(error: unknown, key: string): unknown {
  return error && typeof error === "object" && key in error ? (error as Record<string, unknown>)[key] : undefined;
}

/**
 * Auth routes answer clients with generic errors, so this is the only trace of why Supabase
 * refused. Supabase messages can echo the address ("Email address x@y is invalid"), so
 * emails are redacted and nothing request-derived beyond the route name is logged.
 */
export function logAuthFailure(route: string, step: AuthFailureStep, error: unknown): void {
  const status = field(error, "status");
  const code = field(error, "code");
  const message = error instanceof Error || typeof field(error, "message") === "string"
    ? String(field(error, "message")).replace(EMAIL_PATTERN, "[email]").slice(0, 200)
    : undefined;
  console.error(JSON.stringify({
    event: "auth_failure",
    route,
    step,
    status: typeof status === "number" ? status : undefined,
    code: typeof code === "string" ? code : undefined,
    message,
  }));
}
