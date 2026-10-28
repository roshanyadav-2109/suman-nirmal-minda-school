import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import type { Database } from "@/lib/database.types";

// Server-only client with the service-role key: it skips row security, so it is
// used for one job only — creating the login for a registered person the first
// time they sign in with Google. Never import it from client code.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
