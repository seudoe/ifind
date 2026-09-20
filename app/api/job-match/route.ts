import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import JobMatch from '@/models/JobMatch';
import { verifyAuth } from '@/lib/auth';
import { generateJobMatch, saveJobMatch } from '@/lib/jobMatch/jobMatchService';

/**
 * POST /api/job-match
 * Generate a new job match analysis
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resumeId, jobDescriptionId } = body;

    if (!resumeId || !jobDescriptionId) {
      return NextResponse.json(
        { error: 'Resume ID and Job Description ID are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const startTime = Date.now();

    // Generate match analysis
    const matchResult = await generateJobMatch(
      authResult.user._id.toString(),
      resumeId,
      jobDescriptionId
    );

    const processingTime = Date.now() - startTime;

    // Save to database
    const jobMatch = await saveJobMatch(
      authResult.user._id.toString(),
      resumeId,
      jobDescriptionId,
      matchResult,
      processingTime
    );

    return NextResponse.json({
      success: true,
      data: jobMatch,
      message: 'Job match generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating job match:', error);
    return NextResponse.json(
      { error: 'Failed to generate job match', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/job-match
 * Get all job matches for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('resumeId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query: any = { userId: authResult.user._id };
    if (resumeId) {
      query.resumeId = resumeId;
    }

    const jobMatches = await JobMatch.find(query)
      .populate('jobDescriptionId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: jobMatches,
    });
  } catch (error: any) {
    console.error('Error fetching job matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job matches', message: error.message },
      { status: 500 }
    );
  }
}
