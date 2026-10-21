import { readConsent, shouldLoadGa, type Consent } from "./consent";
import { trackingEnabled } from "./config";
import { locationParams, userTypeFromPath, type AnalyticsEvent, type EventParams } from "./events";

interface TrackDeps {
  enabled: boolean;
  consent: Consent;
  pathname: string;
  send: (name: AnalyticsEvent, params: EventParams) => void;
}

/** Sends an event only where the GA tag may run; fills user_type from the route unless given. */
export function trackWith(deps: TrackDeps, event: AnalyticsEvent, params: EventParams = {}): void {
  const { enabled, consent, pathname, send } = deps;
  if (!shouldLoadGa({ enabled, consent, pathname })) return;
  const user_type = params.user_type ?? userTypeFromPath(pathname);
  send(event, user_type ? { user_type, ...params } : params);
}

/** The exact payload sent to gtag: the event params plus sanitized page_location / page_referrer, which win over the caller's. */
export function buildGtagEventParams(
  params: EventParams,
  href: string,
  referrer: string,
  origin: string,
): EventParams & { page_location: string; page_referrer: string } {
  return { ...params, ...locationParams(href, referrer, origin) };
}

/** Client-side event tracking. Safe to call anywhere: it does nothing without consent or outside production. */
export function track(event: AnalyticsEvent, params?: EventParams): void {
  try {
    trackWith(
      {
        enabled: trackingEnabled({
          NODE_ENV: process.env.NODE_ENV,
          NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
        }),
        consent: readConsent(typeof localStorage === "undefined" ? undefined : localStorage),
        pathname: typeof location === "undefined" ? "" : location.pathname,
        send: (name, p) => {
          const gtag = (window as { gtag?: unknown }).gtag;
          if (typeof gtag === "function") {
            gtag("event", name, buildGtagEventParams(p, location.href, document.referrer, location.origin));
          }
        },
      },
      event,
      params,
    );
  } catch {
    // Analytics must never break the page.
  }
}
