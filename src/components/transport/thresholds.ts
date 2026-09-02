// The two numbers every live transport surface has to agree on. When the map
// greys a bus out, the tracker, the fleet board and the dashboard card must all
// be calling it lost at that same instant — a bus that looks grey on the map
// while a card still reads "on the way" is worse than no tracking at all.

/** Silent this long while still claiming to run: the phone is not reporting. */
export const LOST_S = 300;
export const LOST_MS = LOST_S * 1000;

/** Fallback refresh when the realtime socket is gone. Never runs while hidden. */
export const POLL_MS = 5000;
