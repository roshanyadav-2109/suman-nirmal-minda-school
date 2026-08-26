import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root (a parent lockfile exists at C:\Users\singh).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
