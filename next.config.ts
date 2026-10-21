import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Load the GA Data API client (gRPC) with native Node require instead of bundling it.
  serverExternalPackages: ["@google-analytics/data"],
  // Don't advertise the framework, and never ship source maps (and the server paths in them) to browsers.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
