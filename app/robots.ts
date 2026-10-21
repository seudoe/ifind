import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// robots.txt is a courtesy to well-behaved crawlers, not access control: private pages are protected by
// authentication, and carry X-Robots-Tag: noindex (next.config.ts) so they are not listed even if fetched.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/user$", "/employer$"],
      disallow: ["/api/", "/user/", "/employer/", "/moderator/", "/dashboard"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
