import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./config";

export function createSupabaseBrowserClient() {
  const config = supabasePublicConfig();
  return config ? createBrowserClient(config.url, config.key) : null;
}
