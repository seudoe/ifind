import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ChatSession from '@/models/ChatSession';
import ChatMessage from '@/models/ChatMessage';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const query: any = { userId: authResult.user._id };
    if (!includeArchived) {
      query.isArchived = false;
    }

    const sessions = await ChatSession.find(query)
      .sort({ lastMessageAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resumeId, title } = body;

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const session = await ChatSession.create({
      userId: authResult.user._id,
      resumeId,
      title: title || 'New Chat',
      messageCount: 0,
      isArchived: false,
      lastMessageAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Chat session created successfully',
    });
  } catch (error: any) {
    console.error('Error creating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to create chat session', message: error.message },
      { status: 500 }
    );
  }
}
