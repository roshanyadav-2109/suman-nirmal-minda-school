"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import type { Database } from "@/lib/database.types";

// Browser Supabase client. Uses the public anon key; RLS is the security
// boundary, so this is safe to ship to the client.
export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
}
