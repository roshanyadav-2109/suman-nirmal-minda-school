"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/index";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  // persist to profile too (best-effort; RLS allows self-update)
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from("profile").update({ locale }).eq("id", data.user.id);
}
