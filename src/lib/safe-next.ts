// Where to send someone after they sign in: the page they were trying to open
// (a shared link, with its filters), but only ever a page on this site — never
// another website ("//evil.com") and never back to the login page.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return "/dashboard";
  return next;
}
