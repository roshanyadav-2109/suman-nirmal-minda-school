import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safe-next";

type Saved = { state: string; nonce: string; next: string };
type GoogleClaims = { email?: string; email_verified?: boolean; name?: string; aud?: string };
type Kind = "staff" | "guardian" | "student";
type SchoolRecord = { kind: Kind; id: number; name: string; otherGuardianIds: number[] };
type Admin = ReturnType<typeof createAdminClient>;

const LINK_COLUMN = { staff: "staff_id", guardian: "guardian_id", student: "student_id" } as const;

// Step 2 of "Continue with Google": Google sends the person back here with a
// one-time code. We swap it (with our secret) for Google's signed ID token and
// hand that to Supabase, which checks Google's signature and opens the session.
//
// Access follows the email on the school's records, worked out afresh at every
// sign-in: whichever staff, parent or student record holds this Google email
// is the account they get. The login for that record is created the first time,
// re-pointed if the office changed the record's email, and taken off any other
// record that used to hold the email. No record with this email: no entry.
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
    res.cookies.delete({ name: "g_oauth", path: "/auth/google" });
    return res;
  };

  let saved: Saved | null = null;
  try { saved = JSON.parse(request.cookies.get("g_oauth")?.value ?? "null"); } catch { saved = null; }
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return fail("google_failed");

  // Code -> ID token, straight from Google over TLS.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: new URL("/auth/google/callback", request.nextUrl.origin).toString(),
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json().catch(() => ({}))) as { id_token?: string };
  if (!tokenRes.ok || !tokens.id_token) return fail("google_failed");

  const claims = readClaims(tokens.id_token);
  const email = claims?.email?.trim().toLowerCase();
  if (!email || !claims?.email_verified || claims.aud !== process.env.GOOGLE_CLIENT_ID) return fail("google_failed");

  const admin = createAdminClient();
  const record = await findRecord(admin, email);
  if (!record) return fail("google_not_registered");

  const loginId = await loginForRecord(admin, record, email, claims.name);
  if (!loginId) return fail("google_failed");
  if (record.kind === "guardian") await gatherChildren(admin, record);

  // Nobody else may keep this Google account or email, so Supabase links the
  // Google sign-in to exactly this record's login.
  await admin.rpc("release_login_email" as never, { p_email: email, p_keep: loginId } as never);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: tokens.id_token, nonce: saved.nonce });
  if (error || data.user?.id !== loginId) {
    await supabase.auth.signOut();
    return fail("google_failed");
  }

  const res = NextResponse.redirect(new URL(safeNext(saved.next), request.url));
  res.cookies.delete({ name: "g_oauth", path: "/auth/google" });
  return res;
}

// The ID token came directly from Google's token endpoint over TLS in exchange
// for our secret, so its payload can be read as-is here; Supabase verifies the
// signature itself when it opens the session.
function readClaims(idToken: string): GoogleClaims | null {
  try {
    return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// The school record holding this email. Staff first, then parent, then student,
// so a teacher who is also a parent lands on their staff dashboard. A parent
// whose email is on more than one parent record (one per child, say) gets the
// one that already has a login, or the earliest.
async function findRecord(admin: Admin, email: string): Promise<SchoolRecord | null> {
  const exact = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [{ data: staff }, { data: guardians }, { data: students }] = await Promise.all([
    admin.from("staff").select("id, full_name").ilike("email", exact).order("id"),
    admin.from("guardian").select("id, full_name").ilike("email", exact).order("id"),
    admin.from("student").select("id, full_name").ilike("email", exact).order("id"),
  ]);
  if (staff?.length) return { kind: "staff", id: staff[0].id, name: staff[0].full_name, otherGuardianIds: [] };
  if (guardians?.length) {
    const ids = guardians.map((g) => g.id);
    const { data: linked } = await admin.from("profile").select("guardian_id").in("guardian_id", ids);
    const chosen = guardians.find((g) => linked?.some((l) => l.guardian_id === g.id)) ?? guardians[0];
    return { kind: "guardian", id: chosen.id, name: chosen.full_name, otherGuardianIds: ids.filter((i) => i !== chosen.id) };
  }
  if (students?.length) return { kind: "student", id: students[0].id, name: students[0].full_name, otherGuardianIds: [] };
  return null;
}

// The login (auth user) for this record, with this email on it. Uses the
// record's existing login when it has one — changing its email if the office
// has since changed the record's — or creates one. Returns its id, or null.
async function loginForRecord(admin: Admin, record: SchoolRecord, email: string, googleName?: string): Promise<string | null> {
  const column = LINK_COLUMN[record.kind];
  const { data: profile } = await admin.from("profile").select("id").eq(column, record.id).maybeSingle();

  if (profile) {
    const { data: got } = await admin.auth.admin.getUserById(profile.id);
    if (got.user && (got.user.email ?? "").toLowerCase() !== email) {
      await admin.rpc("release_login_email" as never, { p_email: email, p_keep: profile.id } as never);
      const { error } = await admin.auth.admin.updateUserById(profile.id, { email, email_confirm: true });
      if (error) return null;
    }
    return profile.id;
  }

  // First sign-in for this record: free the email from any old login, then
  // create the login and link it to the record.
  await admin.rpc("release_login_email" as never, { p_email: email, p_keep: "00000000-0000-0000-0000-000000000000" } as never);
  const name = record.name || googleName || email;
  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !created.user) return null;
  const { error: profileErr } = await admin.from("profile").insert({
    id: created.user.id,
    role: record.kind,
    full_name: name,
    staff_id: record.kind === "staff" ? record.id : null,
    guardian_id: record.kind === "guardian" ? record.id : null,
    student_id: record.kind === "student" ? record.id : null,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return null;
  }
  return created.user.id;
}

// A parent's email on several parent records (often one per child): link every
// one of those children to the record they sign in as, so they see them all.
async function gatherChildren(admin: Admin, record: SchoolRecord) {
  if (!record.otherGuardianIds.length) return;
  const [{ data: others }, { data: mine }] = await Promise.all([
    admin.from("guardian_student").select("student_id").in("guardian_id", record.otherGuardianIds),
    admin.from("guardian_student").select("student_id").eq("guardian_id", record.id),
  ]);
  const have = new Set((mine ?? []).map((l) => l.student_id));
  const missing = [...new Set((others ?? []).map((l) => l.student_id))].filter((s) => !have.has(s));
  if (missing.length) {
    await admin.from("guardian_student").insert(missing.map((student_id) => ({ guardian_id: record.id, student_id, is_primary: false })));
  }
}
