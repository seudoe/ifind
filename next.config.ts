import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework, and never ship source maps (and the server paths in them) to browsers.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
