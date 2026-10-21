/** Analytics event names and shared parameter types. Safe to import from client and server code. */

export const ANALYTICS_EVENTS = [
  "sign_up",
  "login",
  "view_internship",
  "apply_click",
  "application_submitted",
  "save_internship",
  "search",
  "resume_uploaded",
  "internship_posted",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type UserType = "student" | "employer";

export interface EventParams {
  user_type?: UserType;
  internship_id?: string;
  result_count?: number;
}

/** Derives the user type from the route: /employer/* is an employer, /user/* is a student. */
export function userTypeFromPath(pathname: string): UserType | undefined {
  if (pathname === "/employer" || pathname.startsWith("/employer/")) return "employer";
  if (pathname === "/user" || pathname.startsWith("/user/")) return "student";
  return undefined;
}

/** Static routes under /user that are not usernames; they are real page names and stay as they are. */
const RESERVED_USER_SEGMENTS: ReadonlySet<string> = new Set(["login", "register"]);

/**
 * Pathname safe to send to Google: query and hash are dropped and the username under /user/<name> is
 * replaced by ":username". Returns null for the moderator area, which is never reported.
 */
export function sanitizePagePath(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0];
  if (path === "/moderator" || path.startsWith("/moderator/")) return null;
  if (path.startsWith("/user/")) {
    const rest = path.slice("/user/".length);
    const slash = rest.indexOf("/");
    const name = slash === -1 ? rest : rest.slice(0, slash);
    if (name && !RESERVED_USER_SEGMENTS.has(name)) return "/user/:username" + (slash === -1 ? "" : rest.slice(slash));
  }
  return path;
}

/**
 * URL safe to send to Google. Same-origin URLs are reduced to origin + sanitized path (empty if the path
 * is never reported); cross-origin URLs pass through; anything unparsable becomes an empty string.
 */
export function sanitizeUrl(url: string, origin: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== origin) return url;
    const path = sanitizePagePath(parsed.pathname);
    return path === null ? "" : origin + path;
  } catch {
    return "";
  }
}

/** Sanitized page_location / page_referrer pair; the one place a location is prepared for Google. */
export function locationParams(
  href: string,
  referrer: string,
  origin: string,
): { page_location: string; page_referrer: string } {
  return { page_location: sanitizeUrl(href, origin), page_referrer: sanitizeUrl(referrer, origin) };
}
