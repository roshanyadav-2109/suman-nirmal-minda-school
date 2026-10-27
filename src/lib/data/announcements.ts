import { createClient } from "@/lib/supabase/server";

export type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  scope: "school" | "class" | "section";
  published_at: string;
  class_id: number | null;
  section_id: number | null;
  section_ids: number[] | null;
  image_url: string | null;
  staff: { full_name: string; role: string } | null;
};

const BASE = "id, title, body, scope, published_at, class_id, section_id, staff:created_by(full_name, role)";

// Announcements visible to the signed-in person (RLS), newest first. Reads the
// image and section-list columns when the database has them (migration 0032)
// and quietly carries on without them when it does not.
export async function getAnnouncements(limit?: number): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const run = (cols: string) => {
    const q = supabase.from("announcement").select(cols).order("published_at", { ascending: false });
    return limit ? q.limit(limit) : q;
  };
  const full = await run(`${BASE}, image_url, section_ids`);
  if (!full.error) return (full.data ?? []) as unknown as AnnouncementRow[];
  const basic = await run(BASE);
  return ((basic.data ?? []) as unknown as Omit<AnnouncementRow, "image_url" | "section_ids">[])
    .map((r) => ({ ...r, image_url: null, section_ids: null }));
}

// "VIII-A" style labels for the sections an announcement names.
export async function getSectionLabels(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!ids.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("section").select("id, name, class:class_id(name)").in("id", [...new Set(ids)]);
  for (const s of data ?? []) {
    const cls = (s.class as unknown as { name: string } | null)?.name;
    map.set(s.id, cls ? `${cls}-${s.name}` : s.name);
  }
  return map;
}
