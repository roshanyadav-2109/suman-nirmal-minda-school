"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";

export async function createAnnouncement(input: {
  title: string;
  body: string;
  scope: "school" | "class" | "section";
  sectionId?: number | null;
  classId?: number | null;
}) {
  const supabase = await createClient();
  const session = await getSession();
  if (!session?.staffId) return { ok: false, error: "Not permitted" };
  const year = await getCurrentYear();

  const { error } = await supabase.from("announcement").insert({
    title: input.title,
    body: input.body,
    scope: input.scope,
    class_id: input.scope === "class" ? input.classId ?? null : null,
    section_id: input.scope === "section" ? input.sectionId ?? null : null,
    academic_year_id: year?.id ?? null,
    created_by: session.staffId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/announcements");
  return { ok: true };
}
