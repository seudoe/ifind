import { str } from "@/lib/validate";
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
import aiService from '@/lib/ai/aiService';
import { withBilling } from '@/lib/usage/withBilling';

/**
 * POST - Trigger resume analysis
 */
async function handlePost(req: NextRequest) {
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
        const jobDescription = str(body?.jobDescription, 20000);

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

        // Determine which AI provider will be used
        const aiProvider = aiService.getActiveProvider();
        const aiModel = aiProvider === 'groq' 
            ? 'groq-llama-3.3-70b' 
            : aiProvider === 'gemini' 
                ? 'gemini-2.5-flash' 
                : 'unknown';

        console.log(`[AnalyzeAPI] Will use AI provider: ${aiProvider}`);

        // Create pending analysis record
        const newAnalysis = new Analysis({
            user: session.userId,
            analysisStatus: 'processing',
            analysisStartedAt: new Date(),
            aiModel,
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
    } catch (error) {
        console.error('[AnalyzeAPI] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
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
    } catch (error) {
        console.error('[AnalyzeAPI GET] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Helper function to extract plain text from parsedData
 */
function extractResumeText(parsedData: any): string {
    if (!parsedData) return '';

    const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);
    const period = (p: any) => (p?.start || p?.end || p?.isCurrent ? `${p.start ?? ''} - ${p.isCurrent ? 'Present' : p.end ?? ''}` : '');
    const section = (title: string, lines: string[]) => (lines.length ? `${title.toUpperCase()}\n${lines.join('\n')}` : '');
    const parts: string[] = [];

    const meta = parsedData.metaDetails;
    if (meta) {
        const contact = [meta.name, meta.email, meta.phone_no, meta.linkedin && 'LinkedIn', meta.github_profile && 'GitHub'].filter(Boolean);
        if (contact.length) parts.push(section('Contact', [contact.join(' | ')]));
    }
    if (parsedData.summary) parts.push(section('Summary', [parsedData.summary]));

    parts.push(section('Skills', list(parsedData.skills).map((s: any) => {
        const tools = list(s.tools).map((t: any) => t.name || t).filter(Boolean).join(', ');
        return typeof s === 'string' ? s : `${s.field || s.name || ''}${tools ? `: ${tools}` : ''}`;
    }).filter(Boolean)));

    parts.push(section('Experience', list(parsedData.workHistory).flatMap((w: any) => [
        `${w.title || ''} at ${w.company || ''}${w.location ? `, ${w.location}` : ''} (${w.type || 'job'}) ${period(w.period)}`.trim(),
        ...list(w.responsibilities).map((r: string) => `- ${r}`),
        ...list(w.achievements).map((r: string) => `- ${r}`),
        ...(w.description ? [String(w.description)] : []),
    ])));

    parts.push(section('Education', list(parsedData.education).map((e: any) =>
        `${e.field?.course || e.degree || ''}${e.field?.type ? ` (${e.field.type})` : ''}, ${e.institution || ''} ${period(e.period)}${e.output ? ` - ${e.output}` : ''}`.trim())));

    parts.push(section('Projects', list(parsedData.projects).flatMap((pr: any) => [
        `${pr.title || pr.name || ''}${pr.role ? ` (${pr.role})` : ''}${list(pr.techStack).length ? ` [${pr.techStack.join(', ')}]` : ''}`,
        ...(pr.problemStatement ? [`Problem: ${pr.problemStatement}`] : []),
        ...(Array.isArray(pr.description) ? pr.description : pr.description ? [pr.description] : []).map((d: string) => `- ${d}`),
        ...list(pr.metrics).map((m: string) => `- Result: ${m}`),
    ])));

    parts.push(section('Certifications', list(parsedData.certifications).map((c: any) => `${c.name}${c.issuer ? `, ${c.issuer}` : ''}${c.date ? ` (${c.date})` : ''}`)));
    parts.push(section('Awards', list(parsedData.awards).map((a: any) => `${a.name}${a.issuingBody ? `, ${a.issuingBody}` : ''}${a.justification ? ` - ${a.justification}` : ''}`)));
    parts.push(section('Publications', list(parsedData.publications).map((x: any) => `${x.title}${x.platform ? `, ${x.platform}` : ''}`)));
    parts.push(section('Affiliations and leadership', list(parsedData.affiliations).flatMap((a: any) => [
        `${a.role || ''}, ${a.organization || ''} ${period(a.period)}`.trim(),
        ...list(a.impact).map((i: string) => `- ${i}`),
    ])));
    parts.push(section('Languages', list(parsedData.languages).map((l: any) => `${l.lang}${l.proficiency ? ` (${l.proficiency})` : ''}`)));
    parts.push(section('Interests', list(parsedData.interests).map((i: any) => `${i.activity}${i.description ? `: ${i.description}` : ''}`)));

    return parts.filter(Boolean).join('\n\n');
}

export const POST = withBilling('resume-analyze', handlePost);
