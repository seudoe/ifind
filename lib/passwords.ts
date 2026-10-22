import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

// A real bcrypt hash (cost 12) of a random throwaway string. Compared against when the account doesn't exist
// or has no password, so "unknown user" costs the same time as "wrong password" and timing can't reveal accounts.
const DUMMY_HASH = "$2b$12$bqT7N4YsfqWIe.VkbycjMO17eK.s30IiBjCXlTLim8lbpQodhUbNu";

export const MAX_PASSWORD_LENGTH = 128; // bcrypt only reads 72 bytes; this also bounds hashing work per request

/** Constant-work password check. Returns false when there is no stored hash. */
export async function checkPassword(plain: string, hash?: string | null): Promise<boolean> {
  const matches = await bcrypt.compare(plain, hash || DUMMY_HASH);
  return Boolean(hash) && matches;
}

const POLICY_MESSAGE = "Password must be at least 8 characters and include an uppercase letter and number";

// The passwords that satisfy "8 characters, an uppercase letter and a number" and still fall to the first guess.
const COMMON = new Set([
  "password1", "password12", "password123", "password1234", "password!1", "passw0rd", "passw0rd1", "p@ssw0rd", "p@ssword1",
  "qwerty123", "qwerty1234", "qwertyuiop1", "qwerty12345", "1qaz2wsx", "1q2w3e4r", "1q2w3e4r5t", "abc12345", "abcd1234", "abcde12345",
  "welcome1", "welcome12", "welcome123", "letmein1", "letmein123", "admin123", "admin1234", "administrator1", "iloveyou1", "iloveyou123",
  "monkey123", "dragon123", "football1", "baseball1", "cricket123", "sunshine1", "princess1", "superman1", "batman123", "master123",
  "changeme1", "changeme123", "test1234", "testing123", "user1234", "login123", "internet1", "student123", "ifind123", "ifind1234",
  "india123", "india@123", "india1234", "mumbai123", "delhi123", "bangalore1", "krishna123", "ganesh123", "shiva123",
  "123456789a", "12345678a", "a1234567", "a12345678", "aa123456", "zaq12wsx", "asdf1234", "asdfghjkl1", "zxcvbnm123",
]);

export interface PasswordContext { email?: string; username?: string; name?: string }

/** Offline checks: length, composition, a short list of known-weak passwords, and the account's own identifiers. */
export function passwordPolicyProblem(password: string, ctx: PasswordContext = {}): string | null {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return POLICY_MESSAGE;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(lower)) return "That password is too common. Choose something harder to guess.";
  const own = [ctx.email?.split("@")[0], ctx.username].filter((v): v is string => !!v && v.length >= 4).map((v) => v.toLowerCase());
  if (own.some((v) => lower.includes(v))) return "Password must not contain your email or username";
  return null;
}

/**
 * Has this password appeared in a public data breach? Uses the Have I Been Pwned range API: only the first 5 hex
 * characters of the SHA-1 leave this server, never the password. Fails open (returns false) when the service is
 * unreachable so sign-ups are not blocked by a third party; set BREACH_CHECK=off to skip it entirely.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (process.env.BREACH_CHECK === "off") return false;
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "iFind-password-check" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const suffix = sha1.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0; // padded fake entries have a count of 0
    });
  } catch {
    return false;
  }
}

/** Full check for a new password: the offline policy, then the breach lookup. Returns a user-facing message or null. */
export async function passwordProblem(password: string, ctx: PasswordContext = {}): Promise<string | null> {
  const policy = passwordPolicyProblem(password, ctx);
  if (policy) return policy;
  if (await isBreachedPassword(password)) return "That password has appeared in a known data breach. Choose a different one.";
  return null;
}
