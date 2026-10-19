"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { trackingEnabled } from "@/lib/analytics/config";
import { readConsent, shouldLoadGa, shouldShowBanner, type Consent } from "@/lib/analytics/consent";
import { locationParams, sanitizePagePath } from "@/lib/analytics/events";
import { ConsentBanner } from "./ConsentBanner";

const noopSubscribe = () => () => {};

function readStoredConsent(): Consent {
  try {
    return readConsent(localStorage);
  } catch {
    return "unset";
  }
}

type GaWindow = { gtag?: (...args: unknown[]) => void } & Record<string, unknown>;

/**
 * Loads gtag.js ourselves instead of using the stock GoogleAnalytics component, so automatic page views
 * (which would carry usernames in the URL) are off and page views are sent sanitized by PageViewTracker.
 */
function GaScript({ gaId, onReady }: { gaId: string; onReady: () => void }) {
  const id = JSON.stringify(gaId);
  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() { window.dataLayer.push(arguments); };
gtag('js', new Date());
gtag('config', ${id}, { send_page_view: false });`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
        onReady={onReady}
      />
    </>
  );
}

/** Sends one sanitized page_view per pathname change. Never sends one for the moderator area. */
function PageViewTracker({ pathname }: { pathname: string }) {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const page_path = sanitizePagePath(pathname);
    if (page_path === null) {
      previous.current = null;
      return;
    }
    const w = window as unknown as GaWindow;
    if (typeof w.gtag !== "function") return;
    const origin = location.origin;
    // Within the app the referrer is the previous page; for the first view it is document.referrer.
    const referrer = previous.current ?? document.referrer;
    previous.current = origin + page_path;
    const loc = locationParams(location.href, referrer, origin);
    // Default location for every later event, including automatic ones, so none carries the raw URL.
    w.gtag("set", loc);
    w.gtag("event", "page_view", { page_path, ...loc });
  }, [pathname]);

  return null;
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  // null on the server and during hydration, so server and client markup match; the stored
  // choice is read right after hydration and nothing renders until then (no banner flash).
  const stored = useSyncExternalStore<Consent | null>(noopSubscribe, readStoredConsent, () => null);
  // A choice made in the banner overrides the stored one for the rest of this visit.
  const [chosen, setChosen] = useState<Consent | null>(null);

  // Set once gtag.js has loaded; page views start from then, so the first one is not sent before gtag exists.
  const [gaReady, setGaReady] = useState(false);

  const consent = chosen ?? stored;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const enabled = trackingEnabled({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_GA_ID: gaId });
  const load = consent !== null && shouldLoadGa({ enabled, consent, pathname });

  // Once gtag has loaded it keeps running across client-side navigation, so switch it off explicitly
  // for the moderator area and for any non-granted consent.
  useEffect(() => {
    if (!enabled || !gaId) return;
    (window as unknown as GaWindow)["ga-disable-" + gaId] = !load;
  }, [enabled, gaId, load]);

  if (consent === null) return null;

  const gate = { enabled, consent, pathname };

  return (
    <>
      {load && gaId && (
        <>
          <GaScript gaId={gaId} onReady={() => setGaReady(true)} />
          {gaReady && <PageViewTracker pathname={pathname} />}
        </>
      )}
      {shouldShowBanner(gate) && <ConsentBanner onChoose={setChosen} />}
    </>
  );
}
