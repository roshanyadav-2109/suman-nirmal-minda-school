// Where to send someone after they sign in: the page they were trying to open
// (a shared link, with its filters), but only ever a page on this site — never
// another website and never back to the login page.
//
// The address is resolved exactly as a browser would (which drops tabs and new
// lines and treats "\" like "/"), so tricks such as "/\t/evil.com" or
// "/\evil.com" can't turn into a link to another site.
const BASE = "https://portal.invalid";

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/dashboard";
  let url: URL;
  try { url = new URL(next, BASE); } catch { return "/dashboard"; }
  if (url.origin !== BASE) return "/dashboard";
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/dashboard";
  return url.pathname + url.search + url.hash;
}
