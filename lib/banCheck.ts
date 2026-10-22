import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { log } from "@/lib/logger";

const TTL_MS = 15_000;
interface AccountState { banned: boolean; tokenVersion: number; exists: boolean; at: number }
const cache = new Map<string, AccountState>();

/**
 * Ban flag and session version for a student, cached for 15 seconds so getSession() doesn't hit the database on
 * every request. A ban or a revocation (logout, deletion) therefore reaches other server instances within seconds,
 * and this instance at once (see revokeStudentSessions).
 */
export async function getAccountState(userId: string): Promise<AccountState | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  try {
    await connectDB();
    const user = await User.findById(userId, { isBanned: 1, tokenVersion: 1 }).lean();
    const state: AccountState = { banned: user?.isBanned === true, tokenVersion: user?.tokenVersion ?? 0, exists: !!user, at: Date.now() };
    cache.set(userId, state);
    if (cache.size > 5000) cache.clear();
    return state;
  } catch (error) {
    // If the lookup fails, don't lock everybody out; login still enforces the ban.
    log.warn("auth/ban-check", "account lookup failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Drops the cached answer so a ban, unban or revocation applies at once on this server instance. */
export function forgetBanCache(userId: string): void {
  cache.delete(userId);
}

/** Invalidates every token issued so far for this student (all devices). */
export async function revokeStudentSessions(userId: string): Promise<void> {
  await connectDB();
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  forgetBanCache(userId);
}
