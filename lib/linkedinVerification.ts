/**
 * LinkedIn's own identity check ("Verified on LinkedIn": government ID + selfie) is NOT part of the sign-in userinfo.
 * It comes from the Verification Report API, which needs the "Verified on LinkedIn" product on the LinkedIn app and the
 * r_verify_details scope. It is opt-in (LINKEDIN_VERIFY=on) because requesting an unapproved scope makes LinkedIn reject sign-in.
 */
export interface LinkedInVerification {
  identity: boolean;
  workplace: boolean;
  checkedAt: Date;
}

export const verificationEnabled = () => process.env.LINKEDIN_VERIFY === "on";

/** Scope string for student sign-in/connect, with the verification scope added when enabled. */
export function linkedinScope(forStudent: boolean): string {
  const base = process.env.LINKEDIN_SCOPE || "openid profile email";
  return forStudent && verificationEnabled() && !base.includes("r_verify") ? `${base} r_verify_details` : base;
}

/** Null when disabled or the call failed: callers keep the previously stored result rather than downgrading on an outage. */
export async function fetchVerification(accessToken: string): Promise<LinkedInVerification | null> {
  if (!verificationEnabled()) return null;
  try {
    const res = await fetch("https://api.linkedin.com/rest/verificationReport", {
      headers: { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202607" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[linkedin/verificationReport] status", res.status);
      return null;
    }
    const json = (await res.json()) as { verifications?: unknown };
    const list = Array.isArray(json.verifications) ? json.verifications.map(String) : [];
    return { identity: list.includes("IDENTITY"), workplace: list.includes("WORKPLACE"), checkedAt: new Date() };
  } catch (error) {
    console.error("[linkedin/verificationReport] failed", error instanceof Error ? error.name : "error");
    return null;
  }
}
