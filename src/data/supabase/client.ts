import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Single Supabase client for the app (auth + data — one client, BUILD-BRIEF §2).
 * The anon/publishable key is safe in the browser; RLS protects the data.
 */
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example), or use VITE_DATA_SOURCE=mock.",
    );
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true, // session lives in localStorage so reload/PWA-relaunch stays signed in
      autoRefreshToken: true,
      detectSessionInUrl: true, // pick up magic-link / OAuth redirects (OTP-code flow needs no redirect)
      flowType: "pkce",
    },
  });
  return client;
}
