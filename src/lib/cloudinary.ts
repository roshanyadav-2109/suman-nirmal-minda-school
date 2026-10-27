import "server-only";
import { createHash } from "node:crypto";

// Server-only Cloudinary access. CLOUDINARY_URL is
//   cloudinary://<api_key>:<api_secret>@<cloud_name>
// and never leaves the server: browsers upload with a short-lived signature
// made here, so the secret is not shipped to anyone.

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

export function cloudinaryConfig(): CloudinaryConfig | null {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;
  const m = raw.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

/** Cloudinary's signature: SHA-1 of the sorted params joined as a query string, plus the secret. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

/** True only for an image delivered from this school's own Cloudinary account. */
export function isOwnCloudinaryImage(url: string, cloudName: string): boolean {
  return url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`);
}
