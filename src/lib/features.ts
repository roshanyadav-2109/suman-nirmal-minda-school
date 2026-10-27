// ─── Feature switches ────────────────────────────────────────────────────────
// School transport is built but not yet launched (guardian alert emails are
// still held — see README). Until it is, every /transport page shows a
// "Coming soon" screen and the bus tiles stay off the dashboards.
//
// Set NEXT_PUBLIC_TRANSPORT_ENABLED=true to switch it on. NEXT_PUBLIC_* vars are
// inlined at BUILD time, so redeploy after changing it.
export const TRANSPORT_ENABLED = process.env.NEXT_PUBLIC_TRANSPORT_ENABLED === "true";
