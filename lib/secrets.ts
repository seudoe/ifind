/**
 * Server-only secret lookup. Never falls back to a default: a missing signing key must stop
 * the request rather than silently sign tokens with a value that is public in the repository.
 */
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Set it in the server environment (see .env.example).`);
  }
  // Short secrets are brute-forceable offline from any leaked token. Warn rather than crash so a
  // deployment with an older, shorter key keeps working until it is rotated.
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    console.warn(`[secrets] ${name} is shorter than 32 characters; rotate it to a long random value.`);
  }
  return value;
}
