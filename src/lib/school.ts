// ─── School identity ─────────────────────────────────────────────────────────
// Single source of truth for everything school-specific in the UI. Every value
// is overridable with a NEXT_PUBLIC_* env var so the same codebase can be
// deployed for another school without touching any component.
//
// NEXT_PUBLIC_* vars are inlined at BUILD time, so each deployment must be
// built with its own values (Vercel: set them on the project, then redeploy).
//
//   NEXT_PUBLIC_SCHOOL_NAME         "The Suman Nirmal Minda School"
//   NEXT_PUBLIC_SCHOOL_PLACE        "Ahmedabad"           (sub-line; may be empty)
//   NEXT_PUBLIC_SCHOOL_SHORT_NAME   "Suman Nirmal Minda School"  (browser title)
//   NEXT_PUBLIC_SCHOOL_MONOGRAM     "SM"                  (emblem fallback, 2 letters)
//   NEXT_PUBLIC_SCHOOL_LOGO         "/brand/school-logo.png"     (file in public/)
//   NEXT_PUBLIC_SCHOOL_LOGIN_IMAGE  ""  (sign-in hero photo; empty = branded panel)

const pick = (v: string | undefined, fallback: string) => (v && v.trim()) || fallback;

const name = pick(process.env.NEXT_PUBLIC_SCHOOL_NAME, "The Suman Nirmal Minda School");
const place = pick(process.env.NEXT_PUBLIC_SCHOOL_PLACE, "Ahmedabad");

export const SCHOOL = {
  /** Primary name, e.g. "Kendriya Vidyalaya No 1". */
  name,
  /** Sub-line under the name, e.g. "IIT Kharagpur". May be "". */
  place,
  /** "Name, Place" — letterheads, report cards, sign-in. */
  fullName: place ? `${name}, ${place}` : name,
  /** Compact label for the browser title bar. */
  shortName: pick(process.env.NEXT_PUBLIC_SCHOOL_SHORT_NAME, "Suman Nirmal Minda School"),
  /** Shown when the logo file is missing. */
  monogram: pick(process.env.NEXT_PUBLIC_SCHOOL_MONOGRAM, "SM").slice(0, 2).toUpperCase(),
  /** Emblem/logo served from public/. */
  logo: pick(process.env.NEXT_PUBLIC_SCHOOL_LOGO, "/brand/school-logo.png"),
  /** Sign-in page hero photograph, served from public/. */
  loginImage: pick(process.env.NEXT_PUBLIC_SCHOOL_LOGIN_IMAGE, ""),
} as const;
