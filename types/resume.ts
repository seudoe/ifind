import type { DateRange } from "./generics";

export interface Skill {
  field: string;
  yearsOfExperience: number;
  lastUsed: string;
  tools: { name: string; score?: number | null }[];
}

export interface Project {
  title: string;
  role: string;
  links: { repo: string; live?: string; demo?: string };
  techStack: string[];
  problemStatement: string | null;
  metrics: string[];
  technicalChallenges: string[];
  description: string[];
  architecture: string;
}

export interface WorkHistory {
  title: string;
  company: string;
  location: string;
  type: "job" | "internship" | "volunteer" | "co-op";
  period: DateRange;
  responsibilities: string[];
  achievements: string[];
}

export interface ResumeEducation {
  institution: string;
  field: { type: string; course: string };
  period: DateRange;
  output: string;
}

export interface Publication {
  title: string;
  platform: string;
  type: "paper" | "article" | "talk";
  link: string;
  keywords: string[];
  date: string;
}

export interface Affiliation {
  organization: string;
  role: string;
  type: string;
  impact: string[];
  period: DateRange;
}

export interface Award {
  name: string;
  issuingBody: string;
  date: string;
  justification: string;
}

export interface ResumeMetaDetails {
  name: string;
  phone_no: string;
  email: string;
  github_profile: string | null;
  linkedin: string | null;
  address: { city: string; country: string; postal_code: string };
  extra_links: { name: string; link: string }[];
}

export interface ParsedResumeData {
  summary: string;
  workHistory: WorkHistory[];
  education: ResumeEducation[];
  skills: Skill[];
  projects: Project[];
  certifications: { name: string; issuer: string; skillsEarned: string[]; type: string; date: string }[];
  languages: { lang: string; proficiency: string; score?: string }[];
  publications: Publication[];
  affiliations: Affiliation[];
  awards: Award[];
  interests: { activity: string; description: string; commitmentMetric?: string }[];
  metaDetails: ResumeMetaDetails;
}

export interface Resume {
  driveFileId?: string | null;
  driveViewLink?: string | null;
  uploadedAt?: string | null;
  parsedData?: ParsedResumeData | null;
}
