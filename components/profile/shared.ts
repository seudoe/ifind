import type { ParsedResumeData, User } from "@/types";

export function emptyResume(user: User): ParsedResumeData {
  return {
    summary: "",
    metaDetails: { name: user.name, phone_no: user.phone ?? "", gender: null, email: user.email, github_profile: null, linkedin: null, address: { city: user.city ?? "", state: user.state ?? "", country: user.country ?? "", postal_code: "" }, extra_links: [] },
    workHistory: [], education: [], skills: [], projects: [], certifications: [], languages: [], publications: [], affiliations: [], awards: [], interests: [],
  };
}

export type EditSection = "personal" | "preferences" | "education" | "skills" | "languages" | "internships" | "projects" | "summary" | "accomplishments" | "employment";
