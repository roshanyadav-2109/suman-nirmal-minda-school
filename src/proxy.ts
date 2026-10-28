import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

// Next 16 renamed `middleware` -> `proxy`. Runs before render: refreshes the
// Supabase session cookie and gates unauthenticated users to /login.
const PUBLIC_PATHS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getClaims().
  // getClaims verifies the JWT against the project's published signing key
  // (cached in memory), so it costs no round trip to the auth server — unlike
  // getUser(), which added one full trip to every page. It still refreshes an
  // expired session through the cookie adapter above.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // Signed out: go to login, remembering the whole link (filters included) so a
  // shared link opens exactly that page once they have signed in.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Already signed in but on the login page: straight on to where they were going.
  if (user && path === "/login") {
    const target = safeNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
