type PublicConfig = { url: string; key: string };

export function supabaseConnectOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/") return null;
    return parsed.origin;
  } catch { return null; }
}

export function readSupabasePublicConfig(environment: Record<string, string | undefined>): PublicConfig | null {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || key.length < 16) return null;
  const origin = supabaseConnectOrigin(url);
  return origin ? { url: origin, key } : null;
}

export function supabasePublicConfig(): PublicConfig | null {
  return readSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
