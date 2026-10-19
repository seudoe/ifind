import { connectDB } from "@/lib/db";
import UsageSettings from "@/models/UsageSettings";
import { DEFAULT_SETTINGS, type UsageSettings as Settings } from "./config";

const TTL_MS = 30_000;
let cache: { at: number; value: Settings } | null = null;

/** Site-wide limits: code defaults, overridden by whatever a moderator saved. Cached for 30 seconds. */
export async function getUsageSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let saved: Awaited<ReturnType<typeof readSaved>> = null;
  try {
    saved = await readSaved();
  } catch {
    // Settings are a convenience; defaults keep the site working if this read fails.
  }
  const value: Settings = {
    defaultDailyCredits: saved?.defaultDailyCredits ?? DEFAULT_SETTINGS.defaultDailyCredits,
    systemDailyBudgetUsd: saved?.systemDailyBudgetUsd ?? DEFAULT_SETTINGS.systemDailyBudgetUsd,
    featureCredits: { ...DEFAULT_SETTINGS.featureCredits, ...(saved?.featureCredits ?? {}) },
    flagThresholds: { ...DEFAULT_SETTINGS.flagThresholds, ...(saved?.flagThresholds ?? {}) },
  };
  cache = { at: Date.now(), value };
  return value;
}

async function readSaved() {
  await connectDB();
  return UsageSettings.findById("global").lean();
}

export function clearUsageSettingsCache(): void {
  cache = null;
}
