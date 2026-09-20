import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ChatSession from '@/models/ChatSession';
import ChatMessage from '@/models/ChatMessage';
import { getSession } from '@/lib/auth';

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const query: any = { userId: session.userId };
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
    const authSession = await getSession();
    if (!authSession) {
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

    const chatSession = await ChatSession.create({
      userId: authSession.userId,
      resumeId,
      title: title || 'New Chat',
      messageCount: 0,
      isArchived: false,
      lastMessageAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: chatSession,
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
