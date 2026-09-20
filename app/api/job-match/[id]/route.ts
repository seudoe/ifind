import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import JobMatch from '@/models/JobMatch';
import { getSession } from '@/lib/auth';

/**
 * GET /api/job-match/[id]
 * Get a specific job match by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const jobMatch = await JobMatch.findOne({
      _id: id,
      userId: session.userId,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const jobMatch = await JobMatch.findOneAndDelete({
      _id: id,
      userId: session.userId,
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
