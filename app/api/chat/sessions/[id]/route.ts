import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ChatSession from '@/models/ChatSession';
import ChatMessage from '@/models/ChatMessage';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/chat/sessions/[id]
 * Get a specific chat session with its messages
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

    const session = await ChatSession.findOne({
      _id: params.id,
      userId: authResult.user._id,
    }).lean();

    if (!session) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get messages for this session
    const messages = await ChatMessage.find({ sessionId: params.id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        session,
        messages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching chat session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat session', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat/sessions/[id]
 * Update a chat session (title, archive status)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, isArchived } = body;

    await connectDB();

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const session = await ChatSession.findOneAndUpdate(
      {
        _id: params.id,
        userId: authResult.user._id,
      },
      { $set: updateData },
      { new: true }
    );

    if (!session) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Chat session updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to update chat session', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/sessions/[id]
 * Delete a chat session and all its messages
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

    // Delete session
    const session = await ChatSession.findOneAndDelete({
      _id: params.id,
      userId: authResult.user._id,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Delete all messages in this session
    await ChatMessage.deleteMany({ sessionId: params.id });

    return NextResponse.json({
      success: true,
      message: 'Chat session deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat session', message: error.message },
      { status: 500 }
    );
  }
}
