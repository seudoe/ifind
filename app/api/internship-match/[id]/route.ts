import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import JobMatch from '@/models/JobMatch';
import { getSession } from '@/lib/auth';

/**
 * GET /api/internship-match/[id]
 * Get a specific internship match by ID
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
        { error: 'Internship match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobMatch,
    });
  } catch (error: any) {
    console.error('Error fetching internship match:', error);
    return NextResponse.json(
      { error: 'Failed to fetch internship match', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/internship-match/[id]
 * Delete an internship match
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
        { error: 'Internship match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Internship match deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting internship match:', error);
    return NextResponse.json(
      { error: 'Failed to delete internship match', message: error.message },
      { status: 500 }
    );
  }
}
