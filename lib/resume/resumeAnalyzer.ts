/**
 * Resume Analyzer Service for iFind
 * Comprehensive resume analysis with scoring, skill extraction, and recommendations
 * 
 * Uses Groq API (llama-3.3-70b-versatile) for cost-effective AI analysis
 */

import groqService from '../groq/groqService';
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
 * Analyze resume with comprehensive ATS-focused scoring
 */
export async function analyzeResume(input: AnalysisInput): Promise<AnalysisResult> {
    const { resumeText, structuredData, jobDescription } = input;

    if (!resumeText || resumeText.trim().length < 50) {
        throw new Error('Resume text is too short for meaningful analysis');
    }

    try {
        console.log('[ResumeAnalyzer] Starting comprehensive ATS analysis...');
        console.log(`[ResumeAnalyzer] Resume length: ${resumeText.length} characters`);

        // Prepare comprehensive ATS-focused analysis prompt
        const analysisPrompt = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze this resume and provide detailed, actionable feedback to help the candidate create an ATS-friendly resume that will pass automated screening systems.

RESUME TO ANALYZE:
${resumeText}

${jobDescription ? `\nTARGET JOB DESCRIPTION:\n${jobDescription}\n` : ''}

Provide a comprehensive analysis focusing on ATS compatibility:

1. **SCORING** (0-100 for each category):
   - **overallScore**: Overall resume quality and ATS friendliness
   - **atsScore**: How well this resume will perform in ATS systems (keyword optimization, format compatibility, standard sections)
   - **readabilityScore**: Clarity, grammar, and professional language
   - **formatScore**: Structure, consistency, proper use of headers, bullets, dates
   - **contentScore**: Depth of experience, quantifiable achievements, relevance

2. **STRENGTHS**: List 3-6 specific strengths (e.g., "Strong quantified achievements in project descriptions", "Excellent keyword density for technical roles")

3. **WEAKNESSES**: List 3-6 specific areas needing improvement (e.g., "Missing action verbs in work experience", "Inconsistent date formatting")

4. **KEYWORD MATCHES**: Identify 5-15 important keywords found in the resume that would help with ATS
   Return as array of objects: [{"keyword": "Python", "category": "technical", "frequency": 3}]
   Categories: technical, soft, industry

5. **MISSING SKILLS**: Identify 5-10 critical skills/keywords commonly expected but missing from this resume
   Return as array of objects: [{"skill": "Project Management", "category": "soft skill", "importance": "high"}]
   Importance levels: high, medium, low

6. **RECOMMENDATIONS**: Provide 6-10 specific, actionable recommendations to improve ATS score:
   - How to add missing keywords naturally
   - Formatting improvements for ATS parsing
   - Section organization improvements
   - Ways to quantify achievements
   - Action verb improvements
   Be specific and practical.

7. **SUMMARY**: Write a 2-3 sentence overall assessment focusing on ATS readiness and top priority improvements.

**IMPORTANT**: 
- Be critical but constructive
- Focus on ATS compatibility - will automated systems parse this correctly?
- All scores should reflect the ACTUAL content, not generic scores
- Recommendations must be specific to THIS resume, not generic advice
- Consider: Are sections clearly labeled? Are dates formatted consistently? Are there measurable achievements?

Return ONLY valid JSON (no markdown, no code blocks):
{
  "overallScore": <number 0-100>,
  "atsScore": <number 0-100>,
  "readabilityScore": <number 0-100>,
  "formatScore": <number 0-100>,
  "contentScore": <number 0-100>,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "keywordMatches": [{"keyword": <string>, "category": <string>, "frequency": <number>}, ...],
  "missingSkills": [{"skill": <string>, "category": <string>, "importance": <string>}, ...],
  "recommendations": [<string>, ...],
  "summary": <string>
}`;

        // Call Groq service for analysis
        const response = await groqService.chat(analysisPrompt, [], true);

        console.log('[ResumeAnalyzer] Received response from Groq');

        // Parse and validate response
        const analysisResult = parseAnalysisResponse(response);

        console.log('[ResumeAnalyzer] Analysis completed successfully');
        console.log(`[ResumeAnalyzer] Scores - Overall: ${analysisResult.overallScore}, ATS: ${analysisResult.atsScore}`);

        // Add metadata
        analysisResult.analyzedAt = new Date();
        analysisResult.analyzedVersion = '2.0'; // Updated version for Groq-based analysis

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
        console.log('[ResumeAnalyzer] Extracting skills from resume...');

        const skillsPrompt = `You are a technical recruiter. Extract and categorize ALL skills from this resume.

RESUME:
${resumeText}

${structuredData?.skills ? `\nEXISTING SKILLS LIST: ${JSON.stringify(structuredData.skills)}` : ''}

Extract:
1. **Technical skills**: Programming languages, frameworks, libraries, databases, tools (e.g., Python, React, MongoDB, Docker)
2. **Soft skills**: Leadership, communication, teamwork, problem-solving, etc.
3. **Languages**: Spoken/written languages (e.g., English, Spanish)
4. **Tools**: Software, platforms, methodologies (e.g., Git, AWS, Agile)

For each skill, estimate proficiency based on:
- How frequently and prominently mentioned
- Context (led projects with X, expert in Y, familiar with Z)
- Years of experience indicated
- Complexity of projects using that skill

Proficiency levels:
- **expert**: Deep expertise, led complex projects, 5+ years or strong indicators
- **advanced**: Strong working knowledge, 2-4 years, key projects
- **intermediate**: Solid understanding, 1-2 years, some projects
- **beginner**: Basic knowledge, learning, mentioned briefly

Return ONLY a JSON array with NO markdown, NO code blocks:
[
  {"name": "Python", "category": "technical", "proficiency": "advanced", "verified": true},
  {"name": "Leadership", "category": "soft", "proficiency": "intermediate", "verified": true},
  ...
]

Extract at least 10-20 skills if available. Be thorough.`;

        const response = await groqService.chat(skillsPrompt, [], true);
        console.log('[ResumeAnalyzer] Skills extracted from Groq');
        
        const skills = parseSkillsResponse(response);
        console.log(`[ResumeAnalyzer] Parsed ${skills.length} skills`);

        return skills;
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Skill extraction failed:', error);
        
        // Return basic skills from structured data if AI extraction fails
        if (structuredData?.skills && Array.isArray(structuredData.skills)) {
            console.log('[ResumeAnalyzer] Falling back to structured data skills');
            return structuredData.skills.map((skill: any) => {
                const skillName = typeof skill === 'string' ? skill : skill.name || 'Unknown';
                return {
                    name: skillName,
                    category: 'technical' as const,
                    proficiency: 'intermediate' as const,
                    verified: false,
                };
            });
        }
        
        console.warn('[ResumeAnalyzer] No skills could be extracted');
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
        console.log('[ResumeAnalyzer] Parsing analysis response...');
        
        // If response is already parsed object, validate it
        let data: any;
        
        if (typeof response === 'string') {
            // Clean up response - remove markdown code blocks if present
            let cleanResponse = response.trim();
            cleanResponse = cleanResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
            cleanResponse = cleanResponse.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
            
            // Try to find JSON in the text
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                data = JSON.parse(cleanResponse);
            }
        } else {
            data = response;
        }

        // Validate required fields
        if (!data || typeof data !== 'object') {
            throw new Error('Response is not a valid object');
        }

        // Validate and normalize scores (0-100)
        const normalizeScore = (score: any, fieldName: string): number => {
            const num = Number(score);
            if (isNaN(num)) {
                console.warn(`[ResumeAnalyzer] Invalid ${fieldName}: ${score}, defaulting to 0`);
                return 0;
            }
            return Math.min(100, Math.max(0, Math.round(num)));
        };

        const result: AnalysisResult = {
            overallScore: normalizeScore(data.overallScore, 'overallScore'),
            atsScore: normalizeScore(data.atsScore, 'atsScore'),
            readabilityScore: normalizeScore(data.readabilityScore, 'readabilityScore'),
            formatScore: normalizeScore(data.formatScore, 'formatScore'),
            contentScore: normalizeScore(data.contentScore, 'contentScore'),
            strengths: Array.isArray(data.strengths) ? data.strengths.filter((s: any) => s && typeof s === 'string') : [],
            weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses.filter((w: any) => w && typeof w === 'string') : [],
            keywordMatches: Array.isArray(data.keywordMatches) ? data.keywordMatches : [],
            missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
            recommendations: Array.isArray(data.recommendations) ? data.recommendations.filter((r: any) => r && typeof r === 'string') : [],
            summary: data.summary || 'Analysis completed',
        };

        // Validate minimum content
        if (result.strengths.length === 0) {
            throw new Error('No strengths found in analysis');
        }
        if (result.recommendations.length === 0) {
            throw new Error('No recommendations found in analysis');
        }

        console.log('[ResumeAnalyzer] Successfully parsed analysis response');
        console.log(`[ResumeAnalyzer] Found ${result.strengths.length} strengths, ${result.weaknesses.length} weaknesses, ${result.recommendations.length} recommendations`);

        return result;
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Failed to parse analysis response:', error);
        console.error('[ResumeAnalyzer] Raw response:', JSON.stringify(response).substring(0, 500));
        
        throw new Error(`Failed to parse analysis results: ${error.message}`);
    }
}

/**
 * Parse skills response from AI
 */
function parseSkillsResponse(response: any): IExtractedSkill[] {
    try {
        console.log('[ResumeAnalyzer] Parsing skills response...');
        
        // If response is already parsed, use it; otherwise try to extract array
        let data: any[];
        
        if (Array.isArray(response)) {
            data = response;
        } else if (typeof response === 'string') {
            // Clean up response
            let cleanResponse = response.trim();
            cleanResponse = cleanResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
            cleanResponse = cleanResponse.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
            
            const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No array found in response');
            }
        } else if (response && typeof response === 'object' && Array.isArray(response.skills)) {
            // Handle nested response
            data = response.skills;
        } else {
            throw new Error('Invalid response format');
        }

        if (!Array.isArray(data)) {
            throw new Error('Parsed data is not an array');
        }

        // Validate and normalize each skill
        const validCategories = ['technical', 'soft', 'language', 'tool'];
        const validProficiencies = ['beginner', 'intermediate', 'advanced', 'expert'];

        const skills = data
            .filter((skill: any) => skill && typeof skill === 'object' && skill.name)
            .map((skill: any) => ({
                name: String(skill.name).trim(),
                category: (validCategories.includes(skill.category) ? skill.category : 'technical') as any,
                proficiency: (validProficiencies.includes(skill.proficiency) ? skill.proficiency : 'intermediate') as any,
                verified: Boolean(skill.verified),
            }));

        console.log(`[ResumeAnalyzer] Successfully parsed ${skills.length} skills`);
        return skills;
    } catch (error: any) {
        console.error('[ResumeAnalyzer] Failed to parse skills response:', error);
        console.error('[ResumeAnalyzer] Raw response:', JSON.stringify(response).substring(0, 500));
        return [];
    }
}

export default {
    analyzeResume,
    extractSkills,
    calculateSkillMatch,
};
