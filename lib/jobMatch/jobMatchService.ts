import { generateJSON, generateText } from '@/lib/groq/groqService';
import User from '@/models/User';
import JobDescription, { IJobDescription } from '@/models/JobDescription';
import JobMatch from '@/models/JobMatch';

interface ResumeData {
  extractedSkills?: Array<{ skill: string; proficiency?: string }>;
  parsedContent?: {
    experience?: any[];
    education?: any[];
    skills?: string[];
  };
  contentText?: string;
}

interface MatchResult {
  overallScore: number;
  matchDetails: {
    skillsMatch: {
      score: number;
      matchingSkills: Array<{
        skill: string;
        resumeLevel?: string;
        jobRequirement?: string;
      }>;
      missingSkills: string[];
      additionalSkills: string[];
    };
    experienceMatch: {
      score: number;
      yearsRequired?: number;
      yearsInResume?: number;
      analysis: string;
    };
    educationMatch: {
      score: number;
      required?: string;
      actual?: string;
      analysis: string;
    };
    keywordsMatch: {
      score: number;
      matchedKeywords: string[];
      missingKeywords: string[];
      keywordDensity: number;
    };
  };
  recommendations: string[];
  strengthsForRole: string[];
  gapsToAddress: string[];
  aiAnalysis: string;
}

/**
 * Generate job match analysis using Groq AI
 */
export async function generateJobMatch(
  userId: string,
  resumeId: string,
  jobDescriptionId: string
): Promise<MatchResult> {
  try {
    // Fetch user resume data
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch job description
    const jobDescription = await JobDescription.findById(jobDescriptionId).lean();
    if (!jobDescription) {
      throw new Error('Job description not found');
    }

    const resumeData: ResumeData = {
      extractedSkills: user.extractedSkills || [],
      parsedContent: user.parsedContent || {},
      contentText: user.contentText || '',
    };

    // Step 1: Skills matching
    const skillsMatch = await matchSkills(resumeData, jobDescription);

    // Step 2: Experience matching
    const experienceMatch = await matchExperience(resumeData, jobDescription);

    // Step 3: Education matching
    const educationMatch = await matchEducation(resumeData, jobDescription);

    // Step 4: Keywords matching
    const keywordsMatch = await matchKeywords(resumeData, jobDescription);

    // Step 5: Calculate overall score (weighted average)
    const overallScore = Math.round(
      skillsMatch.score * 0.4 +
        experienceMatch.score * 0.3 +
        educationMatch.score * 0.15 +
        keywordsMatch.score * 0.15
    );

    // Step 6: Generate AI-powered comprehensive analysis
    const aiAnalysis = await generateComprehensiveAnalysis(
      resumeData,
      jobDescription,
      {
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordsMatch,
        overallScore,
      }
    );

    // Step 7: Generate recommendations and insights
    const recommendations = await generateRecommendations(
      resumeData,
      jobDescription,
      {
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordsMatch,
      }
    );

    const strengthsForRole = await identifyStrengths(resumeData, jobDescription);
    const gapsToAddress = await identifyGaps(
      skillsMatch.missingSkills,
      experienceMatch,
      educationMatch
    );

    return {
      overallScore,
      matchDetails: {
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordsMatch,
      },
      recommendations,
      strengthsForRole,
      gapsToAddress,
      aiAnalysis,
    };
  } catch (error: any) {
    console.error('Error generating job match:', error);
    throw new Error(`Failed to generate job match: ${error.message}`);
  }
}

/**
 * Match skills between resume and job description
 */
async function matchSkills(
  resumeData: ResumeData,
  jobDescription: IJobDescription
): Promise<any> {
  const resumeSkills = resumeData.extractedSkills?.map((s) => s.skill.toLowerCase()) || [];
  const jobSkills = [
    ...(jobDescription.parsedData?.technicalSkills || []),
    ...(jobDescription.parsedData?.softSkills || []),
    ...(jobDescription.skills || []),
  ].map((s) => s.toLowerCase());

  // Find matching skills
  const matchingSkills = resumeSkills
    .filter((skill) => jobSkills.some((js) => js.includes(skill) || skill.includes(js)))
    .map((skill) => {
      const resumeSkillData = resumeData.extractedSkills?.find(
        (s) => s.skill.toLowerCase() === skill
      );
      return {
        skill: resumeSkillData?.skill || skill,
        resumeLevel: resumeSkillData?.proficiency,
        jobRequirement: 'Required',
      };
    });

  // Find missing skills
  const missingSkills = jobSkills.filter(
    (skill) => !resumeSkills.some((rs) => rs.includes(skill) || skill.includes(rs))
  );

  // Find additional skills (resume has but job doesn't require)
  const additionalSkills = resumeSkills.filter(
    (skill) => !jobSkills.some((js) => js.includes(skill) || skill.includes(js))
  );

  // Calculate score
  const score = jobSkills.length > 0
    ? Math.round((matchingSkills.length / jobSkills.length) * 100)
    : 0;

  return {
    score,
    matchingSkills,
    missingSkills,
    additionalSkills,
  };
}

/**
 * Match experience requirements
 */
async function matchExperience(
  resumeData: ResumeData,
  jobDescription: IJobDescription
): Promise<any> {
  const systemPrompt = `You are an expert at analyzing work experience for job matching. Provide accurate assessments.`;

  const prompt = `Analyze the experience match between this resume and job description.

Job Description:
Title: ${jobDescription.title}
Company: ${jobDescription.company}
Experience Level: ${jobDescription.experienceLevel || 'Not specified'}
Description: ${jobDescription.description}

Resume Experience:
${JSON.stringify(resumeData.parsedContent?.experience || [], null, 2)}

Provide a JSON response with:
{
  "score": 0-100,
  "yearsRequired": number or null,
  "yearsInResume": number or null,
  "analysis": "detailed analysis of experience match"
}`;

  try {
    const result = await generateJSON(prompt, systemPrompt, {
      temperature: 0.3,
      max_tokens: 1024,
    });
    return result;
  } catch (error) {
    return {
      score: 50,
      analysis: 'Unable to analyze experience match',
    };
  }
}

/**
 * Match education requirements
 */
async function matchEducation(
  resumeData: ResumeData,
  jobDescription: IJobDescription
): Promise<any> {
  const systemPrompt = `You are an expert at analyzing education requirements for job matching.`;

  const prompt = `Analyze the education match between this resume and job description.

Job Requirements:
${jobDescription.parsedData?.education?.join(', ') || 'Not specified'}

Resume Education:
${JSON.stringify(resumeData.parsedContent?.education || [], null, 2)}

Provide a JSON response with:
{
  "score": 0-100,
  "required": "education required by job",
  "actual": "education from resume",
  "analysis": "detailed analysis"
}`;

  try {
    const result = await generateJSON(prompt, systemPrompt, {
      temperature: 0.3,
      max_tokens: 1024,
    });
    return result;
  } catch (error) {
    return {
      score: 50,
      analysis: 'Unable to analyze education match',
    };
  }
}

/**
 * Match keywords
 */
async function matchKeywords(
  resumeData: ResumeData,
  jobDescription: IJobDescription
): Promise<any> {
  const resumeText = resumeData.contentText?.toLowerCase() || '';
  const jobText = `${jobDescription.title} ${jobDescription.description}`.toLowerCase();

  // Extract important keywords from job description
  const jobKeywords = extractKeywords(jobText);
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  jobKeywords.forEach((keyword) => {
    if (resumeText.includes(keyword)) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });

  const score = jobKeywords.length > 0
    ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
    : 0;

  const keywordDensity = resumeText.length > 0
    ? (matchedKeywords.length / resumeText.split(' ').length) * 100
    : 0;

  return {
    score,
    matchedKeywords,
    missingKeywords,
    keywordDensity: Math.round(keywordDensity * 100) / 100,
  };
}

/**
 * Extract important keywords from text
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract important terms
  const commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  ]);

  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !commonWords.has(word));

  // Count frequency
  const frequency: Record<string, number> = {};
  words.forEach((word) => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Get top keywords
  return Object.keys(frequency)
    .sort((a, b) => frequency[b] - frequency[a])
    .slice(0, 30);
}

/**
 * Generate comprehensive AI analysis
 */
async function generateComprehensiveAnalysis(
  resumeData: ResumeData,
  jobDescription: IJobDescription,
  matchScores: any
): Promise<string> {
  const systemPrompt = `You are an expert career advisor analyzing job matches. Provide detailed, actionable insights.`;

  const prompt = `Provide a comprehensive analysis of this job match.

Job: ${jobDescription.title} at ${jobDescription.company}
Overall Match Score: ${matchScores.overallScore}/100

Skills Match: ${matchScores.skillsMatch.score}/100
- Matching: ${matchScores.skillsMatch.matchingSkills.length} skills
- Missing: ${matchScores.skillsMatch.missingSkills.length} skills

Experience Match: ${matchScores.experienceMatch.score}/100
Education Match: ${matchScores.educationMatch.score}/100
Keywords Match: ${matchScores.keywordsMatch.score}/100

Provide a detailed analysis covering:
1. Overall fit for the role
2. Key strengths
3. Areas of concern
4. Likelihood of success

Keep it concise but insightful (3-4 paragraphs).`;

  try {
    return await generateText(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 1024,
    });
  } catch (error) {
    return 'Unable to generate detailed analysis at this time.';
  }
}

/**
 * Generate recommendations
 */
async function generateRecommendations(
  resumeData: ResumeData,
  jobDescription: IJobDescription,
  matchDetails: any
): Promise<string[]> {
  const systemPrompt = `You are a career advisor. Provide specific, actionable recommendations.`;

  const prompt = `Based on this job match analysis, provide 5-7 specific recommendations to improve the candidate's chances.

Missing Skills: ${matchDetails.skillsMatch.missingSkills.join(', ')}
Experience Analysis: ${matchDetails.experienceMatch.analysis}
Education Analysis: ${matchDetails.educationMatch.analysis}

Return a JSON array of recommendation strings: ["recommendation 1", "recommendation 2", ...]`;

  try {
    const result = await generateJSON<string[]>(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 1024,
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    return [
      'Review the job description carefully and tailor your resume',
      'Highlight relevant projects and achievements',
      'Consider adding certifications for missing technical skills',
    ];
  }
}

/**
 * Identify strengths
 */
async function identifyStrengths(
  resumeData: ResumeData,
  jobDescription: IJobDescription
): Promise<string[]> {
  const systemPrompt = `You are a career advisor. Identify key strengths for this role.`;

  const prompt = `Identify 4-6 key strengths this candidate has for the role: ${jobDescription.title}

Candidate Skills: ${resumeData.extractedSkills?.map(s => s.skill).join(', ') || 'Not available'}
Job Requirements: ${jobDescription.description.substring(0, 500)}

Return a JSON array of strength strings: ["strength 1", "strength 2", ...]`;

  try {
    const result = await generateJSON<string[]>(prompt, systemPrompt, {
      temperature: 0.6,
      max_tokens: 512,
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    return ['Relevant technical skills', 'Applicable experience'];
  }
}

/**
 * Identify gaps
 */
async function identifyGaps(
  missingSkills: string[],
  experienceMatch: any,
  educationMatch: any
): Promise<string[]> {
  const gaps: string[] = [];

  if (missingSkills.length > 0) {
    gaps.push(`Missing ${missingSkills.length} required skills: ${missingSkills.slice(0, 5).join(', ')}`);
  }

  if (experienceMatch.score < 60) {
    gaps.push(`Experience: ${experienceMatch.analysis}`);
  }

  if (educationMatch.score < 60) {
    gaps.push(`Education: ${educationMatch.analysis}`);
  }

  return gaps;
}

/**
 * Save job match result to database
 */
export async function saveJobMatch(
  userId: string,
  resumeId: string,
  jobDescriptionId: string,
  matchResult: MatchResult,
  processingTime: number
): Promise<any> {
  try {
    const jobMatch = await JobMatch.create({
      userId,
      resumeId,
      jobDescriptionId,
      ...matchResult,
      status: 'completed',
      processingTime,
    });

    return jobMatch;
  } catch (error: any) {
    console.error('Error saving job match:', error);
    throw new Error(`Failed to save job match: ${error.message}`);
  }
}
