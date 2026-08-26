export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Minimal Resend email send. Requires RESEND_API_KEY; from must be a verified
// sender (use onboarding@resend.dev for testing).
export async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, skipped: true, reason: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") ?? "KV IIT KGP <onboarding@resend.dev>", to, subject, html }),
  });
  return { ok: res.ok, status: res.status };
}
