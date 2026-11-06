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

export type ProfileDrawerSection =
  | "personal"
  | "preferences"
  | "education"
  | "skills"
  | "languages"
  | "internships"
  | "employment"
  | "projects"
  | "summary"
  | "accomplishments";

export interface ProfileScoreCategory {
  field: string;
  label: string;
  weight: number;
  earned: number;
  completed: boolean;
  section: ProfileDrawerSection;
  statusDescription: string;
  recommendation?: string;
  currentValue?: string;
}

export interface ProfileScoreExplanation {
  score: number;
  earnedWeight: number;
  totalWeight: number;
  formula: string;
  categories: ProfileScoreCategory[];
  completedCount: number;
  totalWeightedCount: number;
  explanationLines: string[];
  missingCategories: ProfileScoreCategory[];
  missingRecommendations: string[];
}

/**
 * Generates a full itemized explanation of a user's profile completion score.
 * Explains exactly which fields earned points, the weights assigned, the mathematical formula,
 * and multi-line guidance on how to achieve 100%.
 */
export function getProfileScoreExplanation(user: Record<string, any>): ProfileScoreExplanation {
  if (!user || typeof user !== "object") {
    return {
      score: 0,
      earnedWeight: 0,
      totalWeight: 100,
      formula: "(0 / 100) × 100 = 0%",
      categories: [],
      completedCount: 0,
      totalWeightedCount: 0,
      explanationLines: ["No profile details available yet."],
      missingCategories: [],
      missingRecommendations: ["Create or sign in to your profile to view completion breakdown."],
    };
  }

  const resume = user.resume?.parsedData;
  const meta = resume?.metaDetails;

  const rawName = (typeof user.name === "string" && user.name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) || "";
  const hasName = rawName.length > 0;

  const rawEmail = (typeof user.email === "string" && user.email.trim()) ||
    (typeof meta?.email === "string" && meta.email.trim()) || "";
  const hasEmail = rawEmail.length > 0;

  const rawPhone = (typeof user.phone === "string" && user.phone.trim()) ||
    (typeof meta?.phone_no === "string" && meta.phone_no.trim()) || "";
  const hasPhone = rawPhone.length > 0;

  const rawPicture = typeof user.profilePicture === "string" && user.profilePicture.trim();
  const hasPicture = Boolean(rawPicture);

  const locParts = [
    user.city, user.state, user.country,
    meta?.address?.city, meta?.address?.state, meta?.address?.country
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  const locationString = locParts.length > 0 ? Array.from(new Set(locParts)).slice(0, 3).join(", ") : "";
  const hasLocation = locationString.length > 0;

  const educationList = Array.isArray(resume?.education) ? resume.education : [];
  const hasEducation = educationList.length > 0;
  const topEducation = hasEducation
    ? `${educationList[0]?.field?.type || "Degree"}${educationList[0]?.institution ? ` at ${educationList[0].institution}` : ""}`
    : "";

  const userSkills = Array.isArray(user.skills) ? user.skills : [];
  const resumeSkills = Array.isArray(resume?.skills) ? resume.skills : [];
  const totalSkillsCount = userSkills.length + resumeSkills.reduce((acc: number, group: any) => {
    return acc + (Array.isArray(group?.tools) ? group.tools.length : 0);
  }, 0);
  const hasSkills = userSkills.length > 0 || resumeSkills.length > 0;

  const summaryText = typeof resume?.summary === "string" ? resume.summary.trim() : "";
  const hasSummary = summaryText.length > 0;

  const projectsList = Array.isArray(resume?.projects) ? resume.projects : [];
  const hasProjects = projectsList.length > 0;

  const workHistory = Array.isArray(resume?.workHistory) ? resume.workHistory : [];
  const internshipsList = workHistory.filter(
    (w: any) => w && (w.type === "internship" || (typeof w.title === "string" && w.title.trim().length > 0))
  );
  const hasInternships = internshipsList.length > 0;

  const certsList = Array.isArray(resume?.certifications) ? resume.certifications : [];
  const awardsList = Array.isArray(resume?.awards) ? resume.awards : [];
  const affilsList = Array.isArray(resume?.affiliations) ? resume.affiliations : [];
  const certCount = certsList.length + awardsList.length + affilsList.length;
  const hasCertifications = certCount > 0;

  const rawCategories: Omit<ProfileScoreCategory, "earned">[] = [
    {
      field: "name",
      label: "Full Name",
      weight: profile_field_weight.name ?? 20,
      completed: hasName,
      section: "personal",
      statusDescription: hasName ? `Full name provided: "${rawName}"` : "Missing: Recruiter-facing full name is not set.",
      recommendation: "Add your full legal or preferred name in Personal Details (+20 pts).",
      currentValue: rawName || undefined,
    },
    {
      field: "email",
      label: "Email Address",
      weight: profile_field_weight.email ?? 10,
      completed: hasEmail,
      section: "personal",
      statusDescription: hasEmail ? `Contact email provided: "${rawEmail}"` : "Missing: Primary contact email is not set.",
      recommendation: "Provide your active email address so recruiters can reach you (+10 pts).",
      currentValue: rawEmail || undefined,
    },
    {
      field: "phone",
      label: "Phone Number",
      weight: profile_field_weight.phone ?? 10,
      completed: hasPhone,
      section: "personal",
      statusDescription: hasPhone ? `Contact number provided: "${rawPhone}"` : "Missing: Contact phone / mobile number is not set.",
      recommendation: "Add your phone number for interview scheduling and SMS updates (+10 pts).",
      currentValue: rawPhone || undefined,
    },
    {
      field: "education",
      label: "Education & Degree",
      weight: profile_field_weight.education ?? 15,
      completed: hasEducation,
      section: "education",
      statusDescription: hasEducation ? `${educationList.length} education entry listed (${topEducation}).` : "Missing: Academic degree or college history not added.",
      recommendation: "Add your university, college degree, or graduation status (+15 pts).",
      currentValue: topEducation || undefined,
    },
    {
      field: "skills",
      label: "Key Skills",
      weight: profile_field_weight.skills ?? 15,
      completed: hasSkills,
      section: "skills",
      statusDescription: hasSkills ? `${totalSkillsCount || resumeSkills.length} skill(s) listed across technical domains.` : "Missing: No technical or professional skills added.",
      recommendation: "List your key skills and competencies (e.g. Python, React, SQL) (+15 pts).",
      currentValue: totalSkillsCount ? `${totalSkillsCount} skills` : undefined,
    },
    {
      field: "summary",
      label: "Profile Summary",
      weight: profile_field_weight.summary ?? 8,
      completed: hasSummary,
      section: "summary",
      statusDescription: hasSummary ? `Summary bio provided (${summaryText.slice(0, 45)}...).` : "Missing: No profile bio or career summary provided.",
      recommendation: "Write a short summary highlighting your career goals and strengths (+8 pts).",
      currentValue: summaryText ? `${summaryText.slice(0, 60)}...` : undefined,
    },
    {
      field: "projects",
      label: "Projects",
      weight: profile_field_weight.projects ?? 8,
      completed: hasProjects,
      section: "projects",
      statusDescription: hasProjects ? `${projectsList.length} project(s) listed with details.` : "Missing: No personal or academic projects listed.",
      recommendation: "Add at least one project showcasing what you have built (+8 pts).",
      currentValue: projectsList[0]?.title || undefined,
    },
    {
      field: "location",
      label: "Location",
      weight: profile_field_weight.location ?? 5,
      completed: hasLocation,
      section: "personal",
      statusDescription: hasLocation ? `Location specified: "${locationString}"` : "Missing: City, state, or country is not specified.",
      recommendation: "Add your current city and country to match with local/hybrid opportunities (+5 pts).",
      currentValue: locationString || undefined,
    },
    {
      field: "profilePicture",
      label: "Profile Picture",
      weight: profile_field_weight.profilePicture ?? 5,
      completed: hasPicture,
      section: "personal",
      statusDescription: hasPicture ? "Avatar photo uploaded." : "Missing: Profile photo or avatar is not uploaded.",
      recommendation: "Upload a clean headshot or profile photo in Personal Details (+5 pts).",
    },
    {
      field: "certifications",
      label: "Certificates & Awards",
      weight: profile_field_weight.certifications ?? 4,
      completed: hasCertifications,
      section: "accomplishments",
      statusDescription: hasCertifications ? `${certCount} certification(s), award(s), or affiliation(s) recorded.` : "Missing: No certificates, awards, or student affiliations recorded.",
      recommendation: "Add certifications, licenses, competitions, or student club roles (+4 pts).",
      currentValue: certsList[0]?.name || awardsList[0]?.name || affilsList[0]?.organization || undefined,
    },
    {
      field: "internships",
      label: "Internships & Experience",
      weight: profile_field_weight.internships ?? 0,
      completed: hasInternships,
      section: "internships",
      statusDescription: hasInternships ? `${internshipsList.length} internship/job experience entry listed.` : "Optional: Weighted at 0 pts so first-time applicants are not penalized.",
      recommendation: "Add any previous internships or practical work experience (optional).",
      currentValue: internshipsList[0]?.title || undefined,
    },
  ];

  let totalWeight = 0;
  let earnedWeight = 0;

  const categories: ProfileScoreCategory[] = rawCategories.map((c) => {
    const earned = c.completed && c.weight > 0 ? c.weight : 0;
    if (c.weight > 0) {
      totalWeight += c.weight;
      if (c.completed) {
        earnedWeight += c.weight;
      }
    }
    return {
      ...c,
      earned,
    };
  });

  const score = totalWeight > 0 ? Math.min(100, Math.max(0, Math.round((earnedWeight / totalWeight) * 100))) : 100;
  const formula = `(${earnedWeight} earned points / ${totalWeight} total weight) × 100 = ${score}%`;

  const weightedCategories = categories.filter((c) => c.weight > 0);
  const completedWeightedCount = weightedCategories.filter((c) => c.completed).length;
  const missingCategories = weightedCategories.filter((c) => !c.completed);
  const missingRecommendations = missingCategories.map((c) => c.recommendation).filter(Boolean) as string[];

  const explanationLines: string[] = [
    `Your profile completion score is currently ${score}%, calculated by evaluating ${weightedCategories.length} key profile sections weighted by recruiter priority.`,
    `Calculation Formula: (Earned Weight Points ÷ Total Weight Points) × 100 → (${earnedWeight} ÷ ${totalWeight}) × 100 = ${score}%.`,
    `You have completed ${completedWeightedCount} of ${weightedCategories.length} weighted sections, earning ${earnedWeight} out of ${totalWeight} total points.`,
  ];

  if (score === 100) {
    explanationLines.push("Congratulations! Your profile has satisfied all weighted categories (100/100 points). Employer visibility and AI recommendation match quality are at their highest potential.");
  } else {
    explanationLines.push(
      `To reach 100%, complete the remaining ${missingCategories.length} missing section${missingCategories.length > 1 ? "s" : ""} (+${totalWeight - earnedWeight} points needed):`
    );
  }

  return {
    score,
    earnedWeight,
    totalWeight,
    formula,
    categories,
    completedCount: completedWeightedCount,
    totalWeightedCount: weightedCategories.length,
    explanationLines,
    missingCategories,
    missingRecommendations,
  };
}

/**
 * Calculates a user's profile completion percentage (0 - 100) based on configured weights.
 * Checks both top-level user fields and extracted resume.parsedData fields.
 */
export function calculateProfileScore(user: Record<string, any>): number {
  return getProfileScoreExplanation(user).score;
}
