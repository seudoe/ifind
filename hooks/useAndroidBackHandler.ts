"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";

/**
 * Listens for the native Android hardware/gesture back button and navigates to the previous tab/history entry.
 * If a modal, drawer, or sheet is open, onBack can return `true` to indicate the back event was consumed.
 */
export function useAndroidBackHandler(onBack?: () => boolean | void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    async function register() {
      try {
        listenerHandle = await App.addListener("backButton", ({ canGoBack }) => {
          if (onBackRef.current) {
            const consumed = onBackRef.current();
            if (consumed) return;
          }

          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
      } catch {
        // Ignored when not running in Capacitor Android environment
      }
    }

    register();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);
}
