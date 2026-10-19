/** Analytics consent: stored choice plus the rules for when the GA tag and banner may appear. */

export type Consent = "granted" | "denied" | "unset";

export const CONSENT_KEY = "ifind_analytics_consent";

interface GateInput {
  enabled: boolean;
  consent: Consent;
  pathname: string;
}

function isModeratorPath(pathname: string): boolean {
  return pathname === "/moderator" || pathname.startsWith("/moderator/");
}

/** Reads the stored choice; anything unexpected, or unavailable storage, is "unset". */
export function readConsent(storage?: Pick<Storage, "getItem">): Consent {
  try {
    const value = storage?.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    return "unset";
  }
}

/** Persists the choice; silently does nothing if storage is unavailable. */
export function writeConsent(value: "granted" | "denied", storage?: Pick<Storage, "setItem">): void {
  try {
    storage?.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked or full: the choice just won't persist.
  }
}

/**
 * Set-Cookie style strings that expire the GA cookies (`_ga` and `_ga_<id>`) for a measurement id.
 * Each cookie is expired on the host only and on the host plus every parent domain with two or more labels,
 * because GA may have set it on the registrable domain (the browser ignores domains that do not apply).
 */
export function gaCookieExpiries(measurementId: string, hostname: string): string[] {
  const suffix = measurementId.trim().replace(/^G-/, "");
  const names = suffix ? ["_ga", `_ga_${suffix}`] : ["_ga"];
  const host = hostname.toLowerCase();
  const domains: string[] = [];
  if (host && !/^[\d.]+$/.test(host) && !host.includes(":")) {
    const labels = host.split(".");
    for (let i = 0; i <= labels.length - 2; i++) domains.push(labels.slice(i).join("."));
  }
  const attrs = "; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const out: string[] = [];
  for (const name of names) {
    out.push(`${name}=${attrs}`);
    for (const domain of domains) out.push(`${name}=${attrs}; domain=${domain}`);
  }
  return out;
}

/** Expires the GA cookies in the browser; no-op without a document. Never throws. */
export function clearGaCookies(
  measurementId: string | undefined,
  doc?: { cookie: string },
  hostname?: string,
): void {
  try {
    if (!doc) return;
    for (const cookie of gaCookieExpiries(measurementId ?? "", hostname ?? "")) doc.cookie = cookie;
  } catch {
    // Cookies blocked: nothing to clear.
  }
}

/** The GA tag loads only with tracking enabled, consent granted, and outside the moderator area. */
export function shouldLoadGa({ enabled, consent, pathname }: GateInput): boolean {
  return enabled && consent === "granted" && !isModeratorPath(pathname);
}

/** The consent banner shows only while the choice is open, tracking is enabled, and outside the moderator area. */
export function shouldShowBanner({ enabled, consent, pathname }: GateInput): boolean {
  return enabled && consent === "unset" && !isModeratorPath(pathname);
}
