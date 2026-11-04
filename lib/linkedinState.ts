/**
 * A student account's LinkedIn standing, derived from stored fields (never stored itself):
 *  normal    - no LinkedIn connected (email + password)
 *  connected - LinkedIn connected, but LinkedIn has not verified the person's identity (or we could not check)
 *  verified  - LinkedIn connected and LinkedIn's Verification Report lists IDENTITY (government ID + selfie).
 *              The sign-in's email_verified flag is only an email check and never counts.
 */
/**
 * merged = true : "connected" and "verified" are one state. Any account with LinkedIn linked is treated as verified and shown
 *                 as "LinkedIn connected" everywhere (use while LinkedIn's Verification API is unavailable).
 * merged = false: three separate states, verified only when LinkedIn's Verification Report lists IDENTITY.
 */
export const merged: boolean = true;

export type LinkedInState = "normal" | "connected" | "verified";

/** Accounts with BOTH a password and LinkedIn must sign in with LinkedIn at least this often to keep using the password. */
export const LINKEDIN_REAUTH_DAYS = 30;
const DAY = 86_400_000;

interface Shape {
  linkedinId?: string | null;
  linkedinVerification?: { identity?: boolean } | null;
  hasPassword?: boolean;
  password?: string | null;
  linkedinLastAuthAt?: Date | string | null;
  linkedinLinkedAt?: Date | string | null;
}

export function linkedinState(u: Shape): LinkedInState {
  if (!u.linkedinId) return "normal";
  return !merged && u.linkedinVerification?.identity === true ? "verified" : "connected";
}

/** True when the account should get the trusted LinkedIn treatment (badge, green banner): linked, and verified unless merged. */
export const linkedinTrusted = (u: Shape): boolean => Boolean(u.linkedinId) && (merged || u.linkedinVerification?.identity === true);

export const hasBothMethods = (u: Shape): boolean => Boolean(u.linkedinId) && Boolean(u.hasPassword ?? u.password);

/** When the monthly LinkedIn sign-in is next due: null unless the account has both methods, or has no recorded LinkedIn time yet. */
export function linkedinReauthDueAt(u: Shape): Date | null {
  if (!hasBothMethods(u)) return null;
  const last = u.linkedinLastAuthAt ?? u.linkedinLinkedAt;
  if (!last) return null;
  return new Date(new Date(last).getTime() + LINKEDIN_REAUTH_DAYS * DAY);
}

export function linkedinReauthDue(u: Shape, now = Date.now()): boolean {
  const due = linkedinReauthDueAt(u);
  return due !== null && due.getTime() <= now;
}
