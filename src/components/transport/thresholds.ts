// The two numbers every live transport surface has to agree on. When the map
// greys a bus out, the tracker, the fleet board and the dashboard card must all
// be calling it lost at that same instant — a bus that looks grey on the map
// while a card still reads "on the way" is worse than no tracking at all.

/** Silent this long while still claiming to run: the phone is not reporting. */
export const LOST_S = 300;
export const LOST_MS = LOST_S * 1000;

/** Fallback refresh when the realtime socket is gone. Never runs while hidden. */
export const POLL_MS = 5000;

/**
 * Milliseconds to add to the device clock to get the server's.
 *
 * Every "last seen" number compares a Postgres timestamp against the viewer's
 * clock, and phone clocks drift — a device a few minutes fast reports a healthy
 * bus as lost, which is exactly the lie this feature must not tell. The page is
 * rendered with the server's own time, so the difference is measured once and
 * applied from then on.
 */
export function serverSkewMs(serverNowIso: string | null | undefined): number {
  if (!serverNowIso) return 0;
  const t = Date.parse(serverNowIso);
  if (Number.isNaN(t)) return 0;
  const skew = t - Date.now();
  // Beyond a day apart it is not drift, it is a wrong date; trust the device
  // rather than shifting everything by months.
  return Math.abs(skew) > 86_400_000 ? 0 : skew;
}
