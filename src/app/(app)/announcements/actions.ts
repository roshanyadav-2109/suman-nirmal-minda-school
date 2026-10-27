"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, getCurrentYear } from "@/lib/session";
import { cloudinaryConfig, signParams, isOwnCloudinaryImage } from "@/lib/cloudinary";

// Images go straight from the poster's browser to Cloudinary, so a large photo
// never passes through our server. This hands out the one-time signature that
// upload needs — only to staff, who are the only ones who can post.
const UPLOAD_FOLDER = "announcements";
const ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif,heic";

export type UploadTicket =
  | { ok: true; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string; allowedFormats: string }
  | { ok: false; error: string };

export async function signAnnouncementUpload(): Promise<UploadTicket> {
  const session = await getSession();
  if (!session?.staffId) return { ok: false, error: "Only staff can add images." };
  const cfg = cloudinaryConfig();
  if (!cfg) return { ok: false, error: "Image uploads are not set up yet." };
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder: UPLOAD_FOLDER, timestamp };
  return {
    ok: true,
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
    timestamp,
    signature: signParams(params, cfg.apiSecret),
    folder: UPLOAD_FOLDER,
    allowedFormats: ALLOWED_FORMATS,
  };
}

// An announcement goes either to the whole school (principal/office only) or to
// any set of sections the poster picked — several classes at once, leaving out
// whichever sections they unticked.
export async function createAnnouncement(input: {
  title: string;
  body: string;
  audience: "school" | "sections";
  sectionIds?: number[];
  imageUrl?: string | null;
}) {
  const supabase = await createClient();
  const session = await getSession();
  if (!session?.staffId) return { ok: false, error: "Not permitted" };
  const year = await getCurrentYear();

  // Only an image from the school's own Cloudinary account is kept.
  let imageUrl: string | null = null;
  if (input.imageUrl) {
    const cfg = cloudinaryConfig();
    if (!cfg || !isOwnCloudinaryImage(input.imageUrl, cfg.cloudName)) return { ok: false, error: "That image could not be attached." };
    imageUrl = input.imageUrl;
  }

  let target: { scope: "school" | "section"; section_id: number | null; section_ids: number[] | null };
  if (input.audience === "school") {
    if (!session.isAdminScope) return { ok: false, error: "Only the principal or office can post to the whole school." };
    target = { scope: "school", section_id: null, section_ids: null };
  } else {
    const ids = [...new Set((input.sectionIds ?? []).filter((n) => Number.isInteger(n) && n > 0))];
    if (!ids.length) return { ok: false, error: "Choose at least one class or section." };
    // One section keeps the classic single-section shape; several use the list.
    target = { scope: "section", section_id: ids[0], section_ids: ids.length > 1 ? ids : null };
  }

  const { error } = await supabase.from("announcement").insert({
    title: input.title,
    body: input.body,
    scope: target.scope,
    section_id: target.section_id,
    academic_year_id: year?.id ?? null,
    created_by: session.staffId,
    // The new columns are only written when used, so a plain notice still
    // saves on a database that has not had migration 0032 yet.
    ...(target.section_ids ? { section_ids: target.section_ids } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/announcements");
  revalidatePath("/");
  return { ok: true };
}
