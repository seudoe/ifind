"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "ifind-theme";

/** Runs in <head> before first paint so there is no light/dark flash. Keep in sync with applyTheme below. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => { if (readPreference() === "system") applyTheme("system"); cb(); };
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_STORAGE_KEY) { applyTheme(readPreference()); cb(); } };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); mq.removeEventListener("change", onSystem); window.removeEventListener("storage", onStorage); };
}

interface ThemeContextValue {
  /** What the user picked: light, dark or system default. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ preference: "system", setPreference: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);

  const setPreference = useCallback((p: ThemePreference) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, p); } catch { /* private mode: still applies for this page */ }
    applyTheme(p);
    emit();
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
