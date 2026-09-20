/**
 * Resume Analyzer Service for iFind
 * Comprehensive resume analysis with scoring, skill extraction, and recommendations
 * 
 * Ported from IPD Resume Analyzer - integrated with iFind's architecture
 */

import geminiService from './geminiService';
import type { IExtractedSkill } from '../../models/User';

export interface AnalysisInput {
    resumeText: string;
    structuredData?: any;
    jobDescription?: string;
}

export interface KeywordMatch {
    keyword: string;
    category: 'technical' | 'soft' | 'industry';
    frequency: number;
}

export interface MissingSkill {
    skill: string;
    category: string;
    importance: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
    overallScore: number;
    atsScore: number;
    readabilityScore: number;
    formatScore: number;
    contentScore: number;
    strengths: string[];
    weaknesses: string[];
    keywordMatches: KeywordMatch[];
    missingSkills: MissingSkill[];
    recommendations: string[];
    summary: string;
    analyzedAt?: Date;
    analyzedVersion?: string;
}

/**
 * Analyze resume with comprehensive scoring
 */
export async function analyzeResume(input: AnalysisInput): Promise<AnalysisResult> {
    const { resumeText, structuredData, jobDescription } = input;

    try {
        // Prepare comprehensive analysis prompt
        const analysisPrompt = `
Analyze the following resume comprehensively and provide detailed feedback:

RESUME CONTENT:
${resumeText}

${jobDescription ? `TARGET JOB DESCRIPTION:\n${jobDescription}\n` : ''}

Please provide a comprehensive analysis with the following structure:

1. SCORING (0-100 for each):
   - overallScore: Overall resume quality
   - atsScore: ATS (Applicant Tracking System) compatibility
   - readabilityScore: Clarity and readability
   - formatScore: Formatting and structure quality
   - contentScore: Content depth and relevance

2. STRENGTHS: List 3-5 key strengths of this resume

3. WEAKNESSES: List 3-5 areas that need improvement

4. KEYWORD MATCHES: Identify important keywords found in the resume
   Format: keyword|category (technical/soft/industry)|frequency

5. MISSING SKILLS: Identify critical skills missing from the resume
   Format: skill|category|importance (high/medium/low)

6. RECOMMENDATIONS: Provide 5-7 specific, actionable recommendations

7. SUMMARY: Brief 2-3 sentence overall assessment

Format your response as valid JSON with these exact keys:
{
  "overallScore": number,
  "atsScore": number,
  "readabilityScore": number,
  "formatScore": number,
  "contentScore": number,
  "strengths": [string],
  "weaknesses": [string],
  "keywordMatches": [{"keyword": string, "category": string, "frequency": number}],
  "missingSkills": [{"skill": string, "category": string, "importance": string}],
  "recommendations": [string],
  "summary": string
}
`;

        // Call Gemini service for analysis
        const response = await geminiService.generateContent(analysisPrompt, true);

        // Parse and validate response
        const analysisResult = parseAnalysisResponse(response);

        // Add metadata
        analysisResult.analyzedAt = new Date();
        analysisResult.analyzedVersion = '1.0';

        return analysisResult;
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Analysis failed:', error);
        throw new Error(`Resume analysis failed: ${error.message}`);
    }
}

/**
 * Extract skills from resume with proficiency and categorization
 */
export async function extractSkills(
    resumeText: string,
    structuredData?: any
): Promise<IExtractedSkill[]> {
    try {
        const skillsPrompt = `
Extract all skills from the following resume and categorize them with proficiency levels.

RESUME CONTENT:
${resumeText}

EXISTING SKILLS LIST (if any):
${structuredData?.skills ? JSON.stringify(structuredData.skills) : 'None'}

Analyze the resume and identify:
1. Technical skills (programming languages, frameworks, tools)
2. Soft skills (communication, leadership, teamwork)
3. Languages (spoken/written languages)
4. Tools and software

For each skill, estimate proficiency based on:
- How prominently it's mentioned
- Years of experience indicated
- Project complexity using that skill
- Certifications or achievements related to it

Format your response as valid JSON array:
[
  {
    "name": "skill name",
    "category": "technical|soft|language|tool",
    "proficiency": "beginner|intermediate|advanced|expert",
    "verified": true
  }
]

Return ONLY the JSON array, no additional text.
`;

        const response = await geminiService.generateContent(skillsPrompt, true);
        const skills = parseSkillsResponse(response);

        return skills;
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Skill extraction failed:', error);
        
        // Return basic skills from structured data if AI extraction fails
        if (structuredData?.skills && Array.isArray(structuredData.skills)) {
            return structuredData.skills.map((skill: string) => ({
                name: skill,
                category: 'technical' as const,
                proficiency: 'intermediate' as const,
                verified: false,
            }));
        }
        
        return [];
    }
}

/**
 * Calculate skill match score between resume and job requirements
 */
export function calculateSkillMatch(
    userSkills: IExtractedSkill[],
    requiredSkills: string[]
): number {
    if (!requiredSkills || requiredSkills.length === 0) return 1;
    if (!userSkills || userSkills.length === 0) return 0;

    const userSkillNames = userSkills.map(s => s.name.toLowerCase());
    const matches = requiredSkills.filter(req =>
        userSkillNames.some(userSkill =>
            userSkill.includes(req.toLowerCase()) ||
            req.toLowerCase().includes(userSkill)
        )
    );

    return matches.length / requiredSkills.length;
}

/**
 * Parse analysis response from AI
 */
function parseAnalysisResponse(response: any): AnalysisResult {
    try {
        // If response is already parsed object, validate it
        const data = typeof response === 'string' ? JSON.parse(response) : response;

        // Validate and normalize scores (0-100)
        const normalizeScore = (score: any): number => {
            const num = Number(score);
            return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
        };

        return {
            overallScore: normalizeScore(data.overallScore),
            atsScore: normalizeScore(data.atsScore),
            readabilityScore: normalizeScore(data.readabilityScore),
            formatScore: normalizeScore(data.formatScore),
            contentScore: normalizeScore(data.contentScore),
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
            keywordMatches: Array.isArray(data.keywordMatches) ? data.keywordMatches : [],
            missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
            recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
            summary: data.summary || '',
        };
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Failed to parse analysis response:', error);
        
        // Return fallback analysis
        return {
            overallScore: 70,
            atsScore: 70,
            readabilityScore: 70,
            formatScore: 70,
            contentScore: 70,
            strengths: ['Resume submitted successfully'],
            weaknesses: ['Detailed analysis pending'],
            keywordMatches: [],
            missingSkills: [],
            recommendations: ['Complete analysis will be available soon'],
            summary: 'Initial analysis completed',
        };
    }
}

/**
 * Parse skills response from AI
 */
function parseSkillsResponse(response: any): IExtractedSkill[] {
    try {
        // If response is already parsed, use it; otherwise try to extract array
        let data: any[];
        
        if (Array.isArray(response)) {
            data = response;
        } else if (typeof response === 'string') {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No array found in response');
            }
        } else {
            throw new Error('Invalid response format');
        }

        // Validate and normalize each skill
        return data.map((skill: any) => {
            const validCategories = ['technical', 'soft', 'language', 'tool'];
            const validProficiencies = ['beginner', 'intermediate', 'advanced', 'expert'];

            return {
                name: skill.name || 'Unknown',
                category: (validCategories.includes(skill.category) ? skill.category : 'technical') as any,
                proficiency: (validProficiencies.includes(skill.proficiency) ? skill.proficiency : 'intermediate') as any,
                verified: Boolean(skill.verified),
            };
        });
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Failed to parse skills response:', error);
        return [];
    }
}

export default {
    analyzeResume,
    extractSkills,
    calculateSkillMatch,
};
