import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { log } from "@/lib/logger";

const TTL_MS = 60_000;
const cache = new Map<string, { banned: boolean; at: number }>();

/**
 * Whether the account is banned, cached for a minute so getSession() doesn't hit the database on every
 * request. A ban therefore reaches already-logged-in users within about a minute.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.banned;
  try {
    await connectDB();
    const user = await User.findById(userId, { isBanned: 1 }).lean();
    const banned = user?.isBanned === true;
    cache.set(userId, { banned, at: Date.now() });
    if (cache.size > 5000) cache.clear();
    return banned;
  } catch (error) {
    // If the lookup fails, don't lock everybody out; login still enforces the ban.
    log.warn("auth/ban-check", "ban lookup failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Drops the cached answer so a ban or unban applies at once on this server instance. */
export function forgetBanCache(userId: string): void {
  cache.delete(userId);
}
