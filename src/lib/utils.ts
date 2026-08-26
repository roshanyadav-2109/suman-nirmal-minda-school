import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// searchParam helpers. numParam rejects NaN (so `?year=abc` falls back to a
// default via ?? instead of poisoning DB queries with NaN).
export const numParam = (v: string | string[] | undefined): number | null => {
  if (typeof v !== "string" || !v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const strParam = (v: string | string[] | undefined): string | null =>
  typeof v === "string" && v ? v : null;

export const bandLabel: Record<string, string> = {
  A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2", D: "D", E: "E",
};

// direction of a delta -> semantic status token
export function trendStatus(delta: number | null | undefined): "up" | "watch" | "down" | "flat" {
  if (delta === null || delta === undefined) return "flat";
  if (delta >= 2) return "up";
  if (delta <= -2) return "down";
  if (delta < 0) return "watch";
  return "flat";
}
