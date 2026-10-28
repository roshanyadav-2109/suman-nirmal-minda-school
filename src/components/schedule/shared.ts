// Small helpers shared by the schedule components (no React here).

// Very light tints so each subject is easy to spot; text stays black.
const TINTS = ["#F3F8FE", "#F2FAF5", "#FEF8F0", "#F7F4FD", "#FDF3F5", "#F1F9FA", "#FAFAEE", "#F4F6F8"];
export const tintFor = (id: number | undefined) => (id == null ? undefined : TINTS[Math.abs(id) % TINTS.length]);

// "13:25" -> "1:25 pm"
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}
export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;

export const toggleCls = (on: boolean) =>
  on
    ? "border-[#0F6CBD] bg-[#EBF3FC] text-[#0F6CBD] font-semibold"
    : "border-hair bg-surface text-ink-700 hover:border-[#B4D6FA] hover:bg-[#F5F9FE]";

export const DAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
] as const;

export type Period = { period_no: number; label: string; start_time: string; end_time: string; is_break: boolean };
export type SlotRow = {
  id: number;
  section_id: number;
  day_of_week: number;
  period_no: number;
  subject_id: number | null;
  staff_id: number | null;
  room: string | null;
};
export type Named = { id: number; name: string };

// What one cell of the week grid shows.
export type GridCell = { title: string; sub?: string; room?: string | null; tint?: number };
export type GridCells = Record<string, GridCell>; // key: `${day}-${period}`
export const cellKey = (day: number, period: number) => `${day}-${period}`;
