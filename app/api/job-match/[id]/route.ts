import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import JobMatch from '@/models/JobMatch';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/job-match/[id]
 * Get a specific job match by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const jobMatch = await JobMatch.findOne({
      _id: params.id,
      userId: authResult.user._id,
    })
      .populate('jobDescriptionId')
      .lean();

    if (!jobMatch) {
      return NextResponse.json(
        { error: 'Job match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobMatch,
    });
  } catch (error: any) {
    console.error('Error fetching job match:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job match', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/job-match/[id]
 * Delete a job match
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const jobMatch = await JobMatch.findOneAndDelete({
      _id: params.id,
      userId: authResult.user._id,
    });

    if (!jobMatch) {
      return NextResponse.json(
        { error: 'Job match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job match deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting job match:', error);
    return NextResponse.json(
      { error: 'Failed to delete job match', message: error.message },
      { status: 500 }
    );
  }
}
