import { getMobileToken } from "@/lib/mobileAuth";

/**
 * Detects whether the current runtime environment is a native Capacitor app
 * (e.g., Android APK served locally on https://localhost).
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === "capacitor:" ||
      (window.location.hostname === "localhost" && window.location.protocol === "https:") ||
      (window.location.origin === "https://localhost" && !window.location.port)
  );
}

/**
 * Returns the configured backend API origin.
 * In a native app, it points to the remote backend (https://ifind-ifind.vercel.app or env var).
 * If the env var contains "localhost", it is ignored on mobile because mobile devices
 * do not run the Next.js server locally on the device.
 * In a standard web browser, it returns an empty string ("") so that relative paths work transparently.
 */
export function getApiOrigin(): string {
  if (!isNativeApp()) return "";
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL;
  if (configured && !configured.includes("localhost")) {
    return configured.replace(/\/+$/, "");
  }
  return "https://ifind-ifind.vercel.app";
}

/**
 * Prepends the API origin to the given path when running inside a native app.
 */
export function apiUrl(path: string): string {
  const base = getApiOrigin();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Automatically intercepts /api/... fetch requests to:
 * 1. Route relative paths to the remote production backend when in a native app (Capacitor).
 * 2. Automatically inject the persistent Bearer token from device storage whenever available.
 * 3. Enforce credentials: "include" for cookie synchronization.
 */
if (typeof window !== "undefined") {
  try {
    const win = window as unknown as Record<string, unknown>;
    if (!win.__ifind_fetch_intercepted__) {
      win.__ifind_fetch_intercepted__ = true;
      const originalFetch = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        let url: string | undefined;
        if (typeof input === "string") {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if (input && typeof (input as Request).url === "string") {
          url = (input as Request).url;
        }

        const isApi =
          typeof url === "string" &&
          (url.startsWith("/api/") ||
            url === "/api" ||
            url.includes("/api/"));

        if (isApi && typeof url === "string") {
          let targetUrl = url;
          if (isNativeApp() && url.startsWith("/")) {
            targetUrl = apiUrl(url);
          }

          const headers = new Headers(init?.headers);
          const token = getMobileToken();
          if (token && !headers.has("Authorization") && !headers.has("authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          const updatedInit: RequestInit = {
            ...init,
            headers,
            credentials: init?.credentials ?? "include",
          };
          return originalFetch.call(this, targetUrl, updatedInit);
        }
        return originalFetch.call(this, input, init);
      };
    }
  } catch (err) {
    console.error("[apiOrigin] Failed to initialize native fetch interceptor", err);
  }
}
