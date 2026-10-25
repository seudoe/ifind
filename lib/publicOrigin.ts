import type { NextRequest } from "next/server";

/**
 * The origin the browser actually used. Behind the Cloudflare proxy the app only sees its own *.vercel.app host
 * (Vercel overwrites x-forwarded-host), so the proxy passes the public host in x-public-host. It is honoured only
 * for hosts listed in TRUSTED_PUBLIC_HOSTS, so a direct caller cannot point redirects elsewhere.
 */
export function publicOrigin(request: NextRequest): string {
  const claimed = request.headers.get("x-public-host")?.toLowerCase();
  const trusted = (process.env.TRUSTED_PUBLIC_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (claimed && trusted.includes(claimed)) return `https://${claimed}`;
  return request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
