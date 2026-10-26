import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Origin of the ImageKit CDN that serves uploaded resumes/avatars (the resume preview is an <iframe>). */
function imagekitOrigin(): string {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || process.env.IMAGEKIT_URL_ENDPOINT;
  try {
    return endpoint ? new URL(endpoint).origin : "https://ik.imagekit.io";
  } catch {
    return "https://ik.imagekit.io";
  }
}

// Google Analytics 4 (loaded only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set; see components/analytics).
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"];

/**
 * Content-Security-Policy.
 *
 * Next.js injects inline bootstrap scripts, so `script-src` needs 'unsafe-inline' unless every page is rendered
 * dynamically with a per-request nonce (which would give up static rendering of the public pages). Everything else is
 * locked down: no plugins, no <base> hijack, forms post only to this site, and the site can't be framed.
 * 'unsafe-eval' is added in development only (React refresh needs it).
 */
function contentSecurityPolicy(frameAncestors = "'none'"): string {
  const ik = imagekitOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"]), ...(gaEnabled ? GA_SCRIPT : [])],
    "style-src": ["'self'", "'unsafe-inline'"], // React inline style attributes + a few static <style> blocks
    // Listing logos come from many scraped sources, so images may load from any https origin (never http).
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(gaEnabled ? GA_CONNECT : []), ...(isProd ? [] : ["ws:", "wss:"])],
    "frame-src": ["'self'", ik],
    "frame-ancestors": [frameAncestors],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (isProd) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy twin of frame-ancestors 'none'
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS is only meaningful (and only honoured) over HTTPS; sending it in local dev would pin http://localhost.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// Authenticated responses must never be stored by a shared cache or the back/forward cache of a shared device.
const noStore = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];

const nextConfig: NextConfig = {
  /* config options here */
  // Load the GA Data API client (gRPC) with native Node require instead of bundling it.
  serverExternalPackages: ["@google-analytics/data"],
  // Don't advertise the framework, and never ship source maps (and the server paths in them) to browsers.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The resume preview iframe loads this same-origin route, so it may be framed by this site only.
      {
        source: "/api/user/resume/file",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'self'") },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      { source: "/api/:path*", headers: noStore },
      { source: "/user/:username/:path*", headers: noStore },
      { source: "/employer/:path((?!login|register).+)", headers: noStore },
      { source: "/moderator/:path((?!login|register).+)", headers: noStore },
    ];
  },
};

export default nextConfig;
