import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["google_not_registered"]);

// Ends the session and returns to the login page, with a known reason to show.
// Used when someone is signed in but their login no longer has a school record
// behind it, so they aren't bounced between the login page and the dashboard.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("error");
  const to = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) to.searchParams.set("error", reason);
  return NextResponse.redirect(to);
}
