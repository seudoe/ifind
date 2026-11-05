/**
 * Returns true if the current environment is a smaller screen (width < 1024px)
 * or a mobile device / native Capacitor application.
 */
export function isSmallScreen(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth < 1024 ||
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === "capacitor:" ||
    (window.location.hostname === "localhost" && window.location.protocol === "https:") ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Capacitor/i.test(navigator.userAgent)
  );
}

/**
 * Checks if a user-agent string belongs to a mobile or tablet device.
 */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPad|iPod|Mobile|Capacitor/i.test(ua);
}
