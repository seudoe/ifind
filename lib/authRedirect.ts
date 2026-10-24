/** Placeholder for the signed-in user's username inside a post-login path (it is unknown before they sign in). */
export const USERNAME_TOKEN = ":username";

/** Where a signed-out visitor should land after auth to continue what they were doing (e.g. open an internship). */
export function applyHref(slug: string): string {
  return `/user/${USERNAME_TOKEN}/browse/${slug}`;
}

export function authUrl(page: "login" | "register", next: string): string {
  return `/user/${page}?next=${encodeURIComponent(next)}`;
}

/** Accepts only same-site student paths, so a crafted ?next= can never send someone to another site. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/user/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return null;
  if (/^\/user\/(login|register)(\/|$|\?)/.test(raw)) return null;
  return raw;
}

/** Fills in the username; falls back to the dashboard when there is no (valid) next path. */
export function resolveNext(raw: string | null | undefined, username: string): string {
  const next = safeNextPath(raw);
  return next ? next.replace(USERNAME_TOKEN, encodeURIComponent(username)) : `/user/${username}/overview`;
}
