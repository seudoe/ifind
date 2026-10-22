/**
 * Values that have been published in this repository's git history. Anyone can read them, so a token signed
 * with one of them can be forged by anyone. They must never be accepted as a signing key in production.
 */
const PUBLISHED_SECRETS = new Set(["your-super-secret-jwt-key-change-in-production"]);

export function isPublishedSecret(value: string): boolean {
  return PUBLISHED_SECRETS.has(value.trim());
}

/**
 * Server-only secret lookup. Never falls back to a default: a missing signing key must stop
 * the request rather than silently sign tokens with a value that is public in the repository.
 */
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Set it in the server environment (see .env.example).`);
  }
  if (isPublishedSecret(value)) {
    // Fail closed in production: a forgeable signing key is worse than an outage. Warn in development so a
    // local .env that still holds the old placeholder keeps working until it is replaced.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${name} is set to a value that is public in the git history. Generate a new random secret (see .env.example).`);
    }
    console.warn(`[secrets] ${name} is a publicly known placeholder. Replace it before deploying.`);
  }
  // Short secrets are brute-forceable offline from any leaked token. Warn rather than crash so a
  // deployment with an older, shorter key keeps working until it is rotated.
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    console.warn(`[secrets] ${name} is shorter than 32 characters; rotate it to a long random value.`);
  }
  return value;
}
