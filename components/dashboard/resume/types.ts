export interface AnalysisData {
    _id: string;
    user: string;
    analysisStatus: "pending" | "processing" | "completed" | "failed";
    overallScore: number;
    atsScore: number;
    readabilityScore: number;
    formatScore: number;
    contentScore: number;
    strengths: string[];
    weaknesses: string[];
    keywordMatches: Array<{
        keyword: string;
        category: string;
        frequency: number;
    }>;
    missingSkills: Array<{
        skill: string;
        category: string;
        importance: "high" | "medium" | "low";
    }>;
    recommendations: string[];
    summary: string;
    errorMessage?: string; // Added for error handling
    createdAt: string;
    updatedAt: string;
}

export interface ExtractedSkill {
    name: string;
    category: "technical" | "soft" | "language" | "tool";
    proficiency: "beginner" | "intermediate" | "advanced" | "expert";
    verified: boolean;
}
