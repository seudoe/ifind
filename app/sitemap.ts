import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only public, indexable marketing pages. Dashboards, auth screens and APIs are deliberately absent.
const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/user", priority: 1, changeFrequency: "weekly" },
  { path: "/employer", priority: 0.8, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
