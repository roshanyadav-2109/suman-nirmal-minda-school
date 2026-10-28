import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { safeNext } from "@/lib/safe-next";

// Step 1 of "Continue with Google": send the person to Google's sign-in page.
// A random `state` (checked on the way back, against forged returns) and a
// `nonce` (tied into Google's ID token, against replays) are kept in a short-
// lived cookie along with the page they were trying to reach.
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?error=google_off", request.url));

  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const redirectUri = new URL("/auth/google/callback", request.nextUrl.origin).toString();

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", clientId);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  // Google puts this value in the ID token; Supabase is given the raw nonce and
  // checks that its SHA-256 matches.
  google.searchParams.set("nonce", createHash("sha256").update(nonce).digest("hex"));
  google.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(google);
  res.cookies.set("g_oauth", JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return res;
}
