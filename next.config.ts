import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Load the GA Data API client (gRPC) with native Node require instead of bundling it.
  serverExternalPackages: ["@google-analytics/data"],
};

export default nextConfig;
