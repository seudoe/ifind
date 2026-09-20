import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import JobDescription from '@/models/JobDescription';
import { getSession } from '@/lib/auth';

/**
 * GET /api/job-descriptions/[id]
 * Get a specific job description
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

    const jobDescription = await JobDescription.findOne({
      _id: id,
      userId: session.userId,
    }).lean();

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobDescription,
    });
  } catch (error: any) {
    console.error('Error fetching job description:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job description', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/job-descriptions/[id]
 * Update a job description
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    await connectDB();

    const jobDescription = await JobDescription.findOneAndUpdate(
      {
        _id: id,
        userId: session.userId,
      },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobDescription,
      message: 'Job description updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating job description:', error);
    return NextResponse.json(
      { error: 'Failed to update job description', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/job-descriptions/[id]
 * Delete a job description
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

    const jobDescription = await JobDescription.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job description deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting job description:', error);
    return NextResponse.json(
      { error: 'Failed to delete job description', message: error.message },
      { status: 500 }
    );
  }
}
