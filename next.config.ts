import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow the dev server to be reached through preview proxies.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
