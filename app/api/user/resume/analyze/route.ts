/**
 * Resume Analysis API Route for iFind
 * POST /api/user/resume/analyze - Trigger comprehensive resume analysis
 * GET /api/user/resume/analyze - Retrieve latest analysis results
 * 
 * Integrated from IPD Resume Analyzer
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import User from '@/models/User';
import Analysis from '@/models/Analysis';
import { analyzeResume, extractSkills } from '@/lib/resume/resumeAnalyzer';

/**
 * POST - Trigger resume analysis
 */
export async function POST(req: NextRequest) {
    try {
        // Verify authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized - Please login' },
                { status: 401 }
            );
        }

        await connectDB();

        // Get user data
        const userData = await User.findById(session.userId);
        if (!userData) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user has a resume
        if (!userData.resume?.parsedData) {
            return NextResponse.json(
                { error: 'No resume found. Please upload a resume first.' },
                { status: 400 }
            );
        }

        // Parse request body for optional job description
        const body = await req.json().catch(() => ({}));
        const { jobDescription } = body;

        // Extract resume text from parsedData
        const resumeText = extractResumeText(userData.resume.parsedData);

        if (!resumeText || resumeText.trim().length < 100) {
            return NextResponse.json(
                { error: 'Resume content is too short or invalid' },
                { status: 400 }
            );
        }

        // Check if analysis is already in progress
        const existingAnalysis = await Analysis.findOne({
            user: session.userId,
            analysisStatus: 'processing',
        });

        if (existingAnalysis) {
            return NextResponse.json(
                {
                    message: 'Analysis already in progress',
                    analysis: existingAnalysis,
                },
                { status: 200 }
            );
        }

        // Delete any old completed/failed analysis to ensure fresh results
        await Analysis.deleteMany({
            user: session.userId,
            analysisStatus: { $in: ['completed', 'failed'] },
        });
        console.log('[AnalyzeAPI] Deleted old analysis records for fresh analysis');

        // Create pending analysis record
        const newAnalysis = new Analysis({
            user: session.userId,
            analysisStatus: 'processing',
            analysisStartedAt: new Date(),
            aiModel: 'groq-llama-3.3-70b',
            analysisVersion: '2.0',
        });
        await newAnalysis.save();

        try {
            console.log(`[AnalyzeAPI] Starting analysis for user ${session.userId}`);

            // Perform comprehensive analysis
            const analysisResult = await analyzeResume({
                resumeText,
                structuredData: userData.resume.parsedData,
                jobDescription,
            });

            // Extract enhanced skills
            const extractedSkills = await extractSkills(
                resumeText,
                userData.resume.parsedData
            );

            // Update analysis record with results
            newAnalysis.analysisStatus = 'completed';
            newAnalysis.overallScore = analysisResult.overallScore;
            newAnalysis.atsScore = analysisResult.atsScore;
            newAnalysis.readabilityScore = analysisResult.readabilityScore;
            newAnalysis.formatScore = analysisResult.formatScore;
            newAnalysis.contentScore = analysisResult.contentScore;
            newAnalysis.summary = analysisResult.summary;
            newAnalysis.strengths = analysisResult.strengths;
            newAnalysis.weaknesses = analysisResult.weaknesses;
            newAnalysis.keywordMatches = analysisResult.keywordMatches;
            newAnalysis.missingSkills = analysisResult.missingSkills;
            newAnalysis.recommendations = analysisResult.recommendations;
            newAnalysis.generatedAt = new Date();
            newAnalysis.analysisCompletedAt = new Date();
            await newAnalysis.save();

            // Update user's resume with extracted skills and metadata
            userData.resume.extractedSkills = extractedSkills;
            userData.resume.lastAnalyzedAt = new Date();
            await userData.save();

            console.log(`[AnalyzeAPI] Analysis completed for user ${session.userId}`);

            return NextResponse.json(
                {
                    message: 'Resume analysis completed successfully',
                    analysis: newAnalysis,
                    extractedSkills,
                },
                { status: 200 }
            );
        } catch (analysisError: any) {
            // Update analysis record with error
            newAnalysis.analysisStatus = 'failed';
            newAnalysis.errorMessage = analysisError.message;
            newAnalysis.analysisCompletedAt = new Date();
            await newAnalysis.save();

            console.error('[AnalyzeAPI] Analysis failed:', analysisError);

            return NextResponse.json(
                {
                    error: 'Resume analysis failed',
                    details: analysisError.message,
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[AnalyzeAPI] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET - Retrieve latest analysis results
 */
export async function GET(req: NextRequest) {
    try {
        // Verify authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized - Please login' },
                { status: 401 }
            );
        }

        await connectDB();

        // Get latest analysis for user
        const analysis = await Analysis.findOne({ user: session.userId })
            .sort({ createdAt: -1 })
            .lean();

        if (!analysis) {
            return NextResponse.json(
                { message: 'No analysis found. Please analyze your resume first.' },
                { status: 404 }
            );
        }

        // Get user's extracted skills
        const userData = await User.findById(session.userId).select('resume.extractedSkills resume.lastAnalyzedAt');

        return NextResponse.json(
            {
                analysis,
                extractedSkills: userData?.resume?.extractedSkills || [],
                lastAnalyzedAt: userData?.resume?.lastAnalyzedAt,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[AnalyzeAPI GET] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Helper function to extract plain text from parsedData
 */
function extractResumeText(parsedData: any): string {
    if (!parsedData) return '';

    const parts: string[] = [];

    // Add summary
    if (parsedData.summary) {
        parts.push(parsedData.summary);
    }

    // Add skills
    if (parsedData.skills && Array.isArray(parsedData.skills)) {
        parts.push(`Skills: ${parsedData.skills.map((s: any) => s.name || s).join(', ')}`);
    }

    // Add work history
    if (parsedData.workHistory && Array.isArray(parsedData.workHistory)) {
        parsedData.workHistory.forEach((work: any) => {
            parts.push(`${work.title || ''} at ${work.company || ''}`);
            if (work.description) {
                parts.push(work.description);
            }
        });
    }

    // Add education
    if (parsedData.education && Array.isArray(parsedData.education)) {
        parsedData.education.forEach((edu: any) => {
            parts.push(`${edu.field?.course || edu.degree || ''} from ${edu.institution || ''}`);
        });
    }

    // Add projects
    if (parsedData.projects && Array.isArray(parsedData.projects)) {
        parsedData.projects.forEach((project: any) => {
            parts.push(`Project: ${project.name || ''}`);
            if (project.description) {
                parts.push(project.description);
            }
        });
    }

    return parts.filter(Boolean).join('\n\n');
}
