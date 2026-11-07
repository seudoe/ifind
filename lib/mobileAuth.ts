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

export interface AuthDataCheckResult {
  hasData: boolean;
  token: string | null;
  role: "student" | "employer" | null;
  username: string | null;
  targetTab: string | null;
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
 * Parses JWT claims from the token string safely in the browser.
 */
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Saves the authenticated session and token to permanent device storage.
 */
export function saveMobileSession(session: {
  token: string;
  role?: "student" | "employer";
  username?: string;
  email?: string;
  employerId?: string;
}): void {
  if (!isBrowser() || !session.token) return;
  try {
    let role = session.role;
    let username = session.username;
    let email = session.email;
    let employerId = session.employerId;

    const payload = parseJwtPayload(session.token);
    if (payload) {
      if (!role && payload.role) role = payload.role as "student" | "employer";
      if (!username && payload.username) username = String(payload.username);
      if (!email && payload.email) email = String(payload.email);
      if (!employerId && payload.employerId) employerId = String(payload.employerId);
    }
    const resolvedRole: "student" | "employer" = role || "student";

    localStorage.setItem(TOKEN_KEY, session.token);
    const fullSession: MobileSession = {
      token: session.token,
      role: resolvedRole,
      username,
      email,
      employerId,
      savedAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(fullSession));
    localStorage.setItem(LAST_PORTAL_KEY, resolvedRole);

    if (resolvedRole === "student" && username) {
      const existingTab = localStorage.getItem(STUDENT_LAST_TAB_KEY);
      if (!existingTab || !existingTab.startsWith(`/user/${username}`)) {
        localStorage.setItem(STUDENT_LAST_TAB_KEY, `/user/${username}/overview`);
      }
    } else if (resolvedRole === "employer") {
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (!raw && !token) return null;

    let session: MobileSession | null = raw ? (JSON.parse(raw) as MobileSession) : null;
    const activeToken = session?.token || token;
    if (!activeToken) return null;

    if (!session) {
      session = {
        token: activeToken,
        role: "student",
        savedAt: Date.now(),
      };
    }

    const payload = parseJwtPayload(activeToken);
    if (payload) {
      if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
        clearMobileSession();
        return null;
      }
      if (!session.username && payload.username) session.username = String(payload.username);
      if (!session.role && payload.role) session.role = payload.role as "student" | "employer";
      if (!session.email && payload.email) session.email = String(payload.email);
      if (!session.employerId && payload.employerId) session.employerId = String(payload.employerId);
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * High-reliability auth data checker.
 * Validates whether active credentials exist in device storage,
 * checks expiration, extracts role & username, and computes the resumption tab.
 */
export function checkAuthData(): AuthDataCheckResult {
  if (!isBrowser()) {
    return { hasData: false, token: null, role: null, username: null, targetTab: null };
  }

  const session = getMobileSession();
  const token = session?.token || getMobileToken();

  if (!token) {
    return { hasData: false, token: null, role: null, username: null, targetTab: null };
  }

  const payload = parseJwtPayload(token);
  if (payload && typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    clearMobileSession();
    return { hasData: false, token: null, role: null, username: null, targetTab: null };
  }

  const lastPortal = localStorage.getItem(LAST_PORTAL_KEY);
  const role: "student" | "employer" =
    session?.role || (payload?.role as "student" | "employer") || (lastPortal === "employer" ? "employer" : "student");
  const username = session?.username || (payload?.username ? String(payload.username) : null);

  const studentTab = localStorage.getItem(STUDENT_LAST_TAB_KEY);
  const employerTab = localStorage.getItem(EMPLOYER_LAST_TAB_KEY);

  let targetTab: string | null = null;
  if (role === "employer" || lastPortal === "employer") {
    targetTab = employerTab && employerTab.startsWith("/employer/") ? employerTab : "/employer/institutes";
  } else if (username) {
    targetTab = studentTab && studentTab.startsWith(`/user/${username}`) ? studentTab : `/user/${username}/overview`;
  } else {
    targetTab = "/phone";
  }

  return {
    hasData: true,
    token,
    role,
    username,
    targetTab,
  };
}

/**
 * Checks whether an active mobile session token exists.
 */
export function hasMobileSession(): boolean {
  return checkAuthData().hasData;
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
