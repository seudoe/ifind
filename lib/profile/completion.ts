/**
 * Configurable weights for profile completion score calculation.
 * Adjust weights as needed. For example, set internships: 0 if students are not expected to have prior internships.
 * The score is dynamically calculated as: Math.round((earned_weight / total_weight) * 100).
 */
export const profile_field_weight: Record<string, number> = {
  name: 20,              // Recruiter-facing Name (highest weight)
  email: 10,             // Primary contact email
  phone: 10,             // Phone / mobile number
  education: 15,         // College / degree / academic records
  skills: 15,            // Key skills list
  summary: 8,            // Professional profile summary
  projects: 8,           // Projects
  location: 5,           // City / state / country
  profilePicture: 5,     // Profile avatar image
  internships: 0,        // Prior internships (default 0 as students typically seek their first internship)
  certifications: 4,     // Certifications, awards, accomplishments
};

/**
 * Calculates a user's profile completion percentage (0 - 100) based on configured weights.
 * Checks both top-level user fields and extracted resume.parsedData fields.
 */
export function calculateProfileScore(user: Record<string, any>): number {
  if (!user || typeof user !== "object") return 0;

  const resume = user.resume?.parsedData;
  const meta = resume?.metaDetails;

  const hasName = Boolean(
    (typeof user.name === "string" && user.name.trim().length > 0) ||
    (typeof meta?.name === "string" && meta.name.trim().length > 0)
  );

  const hasEmail = Boolean(
    (typeof user.email === "string" && user.email.trim().length > 0) ||
    (typeof meta?.email === "string" && meta.email.trim().length > 0)
  );

  const hasPhone = Boolean(
    (typeof user.phone === "string" && user.phone.trim().length > 0) ||
    (typeof meta?.phone_no === "string" && meta.phone_no.trim().length > 0)
  );

  const hasPicture = Boolean(
    typeof user.profilePicture === "string" && user.profilePicture.trim().length > 0
  );

  const hasLocation = Boolean(
    user.city || user.state || user.country ||
    meta?.address?.city || meta?.address?.state || meta?.address?.country
  );

  const hasEducation = Boolean(
    Array.isArray(resume?.education) && resume.education.length > 0
  );

  const userSkills = Array.isArray(user.skills) ? user.skills : [];
  const resumeSkills = Array.isArray(resume?.skills) ? resume.skills : [];
  const hasSkills = userSkills.length > 0 || resumeSkills.length > 0;

  const hasSummary = Boolean(
    typeof resume?.summary === "string" && resume.summary.trim().length > 0
  );

  const hasProjects = Boolean(
    Array.isArray(resume?.projects) && resume.projects.length > 0
  );

  const workHistory = Array.isArray(resume?.workHistory) ? resume.workHistory : [];
  const hasInternships = workHistory.some(
    (w: any) => w && (w.type === "internship" || (typeof w.title === "string" && w.title.trim().length > 0))
  );

  const hasCertifications = Boolean(
    (Array.isArray(resume?.certifications) && resume.certifications.length > 0) ||
    (Array.isArray(resume?.awards) && resume.awards.length > 0) ||
    (Array.isArray(resume?.affiliations) && resume.affiliations.length > 0)
  );

  const checks: Record<string, boolean> = {
    name: hasName,
    email: hasEmail,
    phone: hasPhone,
    profilePicture: hasPicture,
    location: hasLocation,
    education: hasEducation,
    skills: hasSkills,
    summary: hasSummary,
    projects: hasProjects,
    internships: hasInternships,
    certifications: hasCertifications,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const [field, weight] of Object.entries(profile_field_weight)) {
    if (typeof weight === "number" && weight > 0) {
      totalWeight += weight;
      if (checks[field]) {
        earnedWeight += weight;
      }
    }
  }

  if (totalWeight <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((earnedWeight / totalWeight) * 100)));
}
