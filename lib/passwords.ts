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
