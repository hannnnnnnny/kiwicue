import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = supabasePublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy refreshes the session.
        }
      },
    },
  });
}

export async function verifiedUser() {
  const client = await createSupabaseServerClient();
  if (!client) return { client: null, user: null };
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user: error ? null : user };
}
