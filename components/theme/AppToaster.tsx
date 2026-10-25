"use client";

import { Toaster } from "sonner";
import { useTheme } from "./ThemeProvider";

/** sonner toaster following the app theme; look and feel come from the [data-sonner-*] block in globals.css. */
export function AppToaster() {
  const { preference } = useTheme();
  return <Toaster position="top-right" theme={preference} closeButton />;
}
