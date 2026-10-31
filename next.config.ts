import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow the dev server to be reached through preview proxies.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
