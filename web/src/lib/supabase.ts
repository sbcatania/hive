import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseAvailable() {
  return !!(URL && KEY);
}

let client: SupabaseClient | null = null;

/** Browser Supabase client. Sessions persist in localStorage so sign-in survives reloads. */
export function sb(): SupabaseClient {
  if (!URL || !KEY) throw new Error("Online features are not configured.");
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
