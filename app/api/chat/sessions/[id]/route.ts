import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ChatSession from '@/models/ChatSession';
import ChatMessage from '@/models/ChatMessage';
import { getSession } from '@/lib/auth';

/**
 * GET /api/chat/sessions/[id]
 * Get a specific chat session with its messages
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

    const chatSession = await ChatSession.findOne({
      _id: id,
      userId: session.userId,
    }).lean();

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get messages for this session
    const messages = await ChatMessage.find({ sessionId: id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        session: chatSession,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, isArchived } = body;

    await connectDB();

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const chatSession = await ChatSession.findOneAndUpdate(
      {
        _id: id,
        userId: session.userId,
      },
      { $set: updateData },
      { new: true }
    );

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chatSession,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    // Delete session
    const chatSession = await ChatSession.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Delete all messages in this session
    await ChatMessage.deleteMany({ sessionId: id });

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
