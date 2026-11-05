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
 * In a standard web browser, it returns an empty string ("") so that relative paths work transparently.
 */
export function getApiOrigin(): string {
  if (!isNativeApp()) return "";
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || "https://ifind-ifind.vercel.app";
  return configured.replace(/\/+$/, "");
}

/**
 * Prepends the API origin to the given path when running inside a native app.
 */
export function apiUrl(path: string): string {
  const base = getApiOrigin();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
