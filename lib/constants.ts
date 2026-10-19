import type { InternshipSource } from "@/types/internship";

/** Display names for `internship.source`; order is the order shown in filters. */
export const SOURCE_LABELS: Record<InternshipSource, string> = {
  ifind: "iFind",
  internshala: "Internshala",
  unstop: "Unstop",
  naukri: "Naukri",
  letsintern: "LetsIntern",
  telegram: "Telegram",
  freshersworld: "Freshersworld",
  indeed: "Indeed",
  github: "GitHub",
};

/** Label for any stored source; legacy "web_scraping" and unknown values read as "Web". */
export const sourceLabel = (source?: string | null): string => SOURCE_LABELS[source as InternshipSource] ?? "Web";

export const LOCATIONS = [
  "Work from Home",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Mumbai",
  "Chennai",
  "Pune",
  "Kolkata",
  "Jaipur",
  "International",
];

export const PERKS_OPTIONS = [
  "Certificate",
  "Letter of Recommendation",
  "Flexible Hours",
  "Pre-Placement Offer",
  "Free Meals",
  "5 Days a Week",
  "Informal Dress Code",
];
