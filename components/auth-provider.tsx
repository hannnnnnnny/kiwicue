"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type AuthState = { user: User | null; loading: boolean; enabled: boolean };
const AuthContext = createContext<AuthState>({ user: null, loading: false, enabled: false });
const client = createSupabaseBrowserClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setUser(error ? null : data.user);
      setLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (active && event !== "INITIAL_SESSION") {
        setUser(session?.user ?? null);
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") setLoading(false);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ user, loading, enabled: Boolean(client) }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
export function supabaseBrowser() { return client; }
