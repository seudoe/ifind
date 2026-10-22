import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import JobMatch from '@/models/JobMatch';
import { getSession } from '@/lib/auth';
import JobDescription from '@/models/JobDescription';
import { isObjectId, str } from '@/lib/validate';
import { generateJobMatch, saveJobMatch } from '@/lib/jobMatch/jobMatchService';
import { withBilling } from '@/lib/usage/withBilling';

/**
 * POST /api/internship-match
 * Generate a new internship match analysis
 */
async function handlePost(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // Types are checked before the values reach a query: an object such as {"$gt": ""} must never be used as an id.
    const resumeId = str(body?.resumeId, 100);
    const jobDescriptionId = body?.jobDescriptionId;

    if (!resumeId || !isObjectId(jobDescriptionId)) {
      return NextResponse.json(
        { error: 'Resume ID and Job Description ID are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // The job description must belong to the signed-in user; otherwise anyone who learns an id could read it back.
    if (!(await JobDescription.exists({ _id: jobDescriptionId, userId: session.userId }))) {
      return NextResponse.json({ error: 'Job description not found' }, { status: 404 });
    }

    const startTime = Date.now();

    // Generate match analysis
    const matchResult = await generateJobMatch(
      session.userId.toString(),
      resumeId,
      jobDescriptionId
    );

    const processingTime = Date.now() - startTime;

    // Save to database
    const jobMatch = await saveJobMatch(
      session.userId.toString(),
      resumeId,
      jobDescriptionId,
      matchResult,
      processingTime
    );

    return NextResponse.json({
      success: true,
      data: jobMatch,
      message: 'Internship match generated successfully',
    });
  } catch (error) {
    console.error('Error generating internship match:', error);
    return NextResponse.json(
      { error: 'Failed to generate internship match' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internship-match
 * Get all internship matches for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('resumeId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100);

    const query: any = { userId: session.userId };
    if (resumeId) {
      query.resumeId = resumeId;
    }

    const jobMatches = await JobMatch.find(query)
      .populate({ path: 'jobDescriptionId', match: { userId: session.userId } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: jobMatches,
    });
  } catch (error) {
    console.error('Error fetching internship matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch internship matches' },
      { status: 500 }
    );
  }
}

export const POST = withBilling('job-match', handlePost);
