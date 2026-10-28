import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root (a parent lockfile exists at C:\Users\singh).
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Keep pages someone has just visited in the browser for 30 s, so going back
  // to them is instant. Saving anything refreshes them straight away.
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  // Every page lives under /dashboard/<tab>. Old addresses (bookmarks, links
  // already shared) forward there with their filters kept.
  async redirects() {
    const tabs = [
      "allotments", "announcements", "attendance", "calendar", "feedback", "leave", "manage", "marks",
      "progress", "promotion", "reports", "schedule", "search", "students", "transport",
    ];
    return [
      { source: "/", destination: "/dashboard", permanent: false },
      ...tabs.flatMap((t) => [
        { source: `/${t}`, destination: `/dashboard/${t}`, permanent: false },
        { source: `/${t}/:rest*`, destination: `/dashboard/${t}/:rest*`, permanent: false },
      ]),
    ];
  },
};

export default nextConfig;
