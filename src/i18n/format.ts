import { intlTag, type Locale } from "./index";

export function fmtNumber(locale: Locale, n: number | null | undefined, opts?: Intl.NumberFormatOptions) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(intlTag[locale], opts).format(n);
}

export function fmtPercent(locale: Locale, n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(intlTag[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n) + "%";
}

export function fmtDelta(locale: Locale, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + fmtNumber(locale, n, { maximumFractionDigits: 1 });
}

export function fmtDate(locale: Locale, d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlTag[locale], opts ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function fmtMonth(locale: Locale, d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlTag[locale], { month: "long", year: "numeric" }).format(date);
}

// "2 days ago", "3 months ago", … (locale-aware).
export function fmtRelative(locale: Locale, d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.round((date.getTime() - Date.now()) / 1000); // negative = past
  const rtf = new Intl.RelativeTimeFormat(intlTag[locale], { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [unit, sec] of units) if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  return rtf.format(0, "minute");
}
