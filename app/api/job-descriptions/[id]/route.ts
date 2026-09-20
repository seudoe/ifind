import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import JobDescription from '@/models/JobDescription';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/job-descriptions/[id]
 * Get a specific job description
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

    const jobDescription = await JobDescription.findOne({
      _id: params.id,
      userId: authResult.user._id,
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
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    await connectDB();

    const jobDescription = await JobDescription.findOneAndUpdate(
      {
        _id: params.id,
        userId: authResult.user._id,
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
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const jobDescription = await JobDescription.findOneAndDelete({
      _id: params.id,
      userId: authResult.user._id,
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
