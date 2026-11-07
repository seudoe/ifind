/**
 * Persistent mobile authentication manager.
 * Stores JWT authentication tokens and session state in device flash storage (localStorage)
 * so that mobile APK users remain logged in across app closes, process kills, and phone reboots.
 */

export interface MobileSession {
  token: string;
  role: "student" | "employer";
  username?: string;
  email?: string;
  employerId?: string;
  savedAt: number;
}

const TOKEN_KEY = "ifind_auth_token";
const SESSION_KEY = "ifind_session";
const STUDENT_LAST_TAB_KEY = "ifind_student_last_tab";
const EMPLOYER_LAST_TAB_KEY = "ifind_employer_last_tab";
const LAST_PORTAL_KEY = "ifind_last_active_portal";

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Saves the authenticated session and token to permanent device storage.
 */
export function saveMobileSession(session: {
  token: string;
  role: "student" | "employer";
  username?: string;
  email?: string;
  employerId?: string;
}): void {
  if (!isBrowser() || !session.token) return;
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    const fullSession: MobileSession = {
      ...session,
      savedAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(fullSession));
    localStorage.setItem(LAST_PORTAL_KEY, session.role);

    if (session.role === "student" && session.username) {
      const existingTab = localStorage.getItem(STUDENT_LAST_TAB_KEY);
      if (!existingTab || !existingTab.startsWith(`/user/${session.username}`)) {
        localStorage.setItem(STUDENT_LAST_TAB_KEY, `/user/${session.username}/overview`);
      }
    } else if (session.role === "employer") {
      const existingTab = localStorage.getItem(EMPLOYER_LAST_TAB_KEY);
      if (!existingTab || !existingTab.startsWith("/employer/")) {
        localStorage.setItem(EMPLOYER_LAST_TAB_KEY, "/employer/institutes");
      }
    }
  } catch (err) {
    console.error("[mobileAuth] Failed to save session to localStorage:", err);
  }
}

/**
 * Retrieves the stored JWT authentication token.
 */
export function getMobileToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Retrieves the full stored session object.
 */
export function getMobileSession(): MobileSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileSession;
  } catch {
    return null;
  }
}

/**
 * Checks whether an active mobile session token exists.
 */
export function hasMobileSession(): boolean {
  return Boolean(getMobileToken());
}

/**
 * Clears all persistent mobile session credentials on user logout.
 */
export function clearMobileSession(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STUDENT_LAST_TAB_KEY);
    localStorage.removeItem(EMPLOYER_LAST_TAB_KEY);
    localStorage.removeItem(LAST_PORTAL_KEY);
  } catch (err) {
    console.error("[mobileAuth] Failed to clear session from localStorage:", err);
  }
}
