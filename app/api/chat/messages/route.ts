import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ChatSession from '@/models/ChatSession';
import ChatMessage from '@/models/ChatMessage';
import User from '@/models/User';
import { getSession } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/groq/groqService';
import { prepareChatContext, detectResumeSection, extractSection } from '@/lib/chat/embeddingService';
import { extractResumeText } from '@/lib/resume/resumeTextExtractor';

/**
 * POST /api/chat/messages
 * Send a message and get AI response with RAG
 */
export async function POST(req: NextRequest) {
  try {
    const authSession = await getSession();
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, content } = body;

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: 'Session ID and message content are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get session
    const chatSession = await ChatSession.findOne({
      _id: sessionId,
      userId: authSession.userId,
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get user's resume
    const user = await User.findById(authSession.userId).lean();
    if (!user || !user.resume?.parsedData) {
      return NextResponse.json(
        { error: 'Resume not found. Please upload a resume first.' },
        { status: 404 }
      );
    }

    const resumeText = extractResumeText(user.resume.parsedData);

    // Save user message
    const userMessage = await ChatMessage.create({
      sessionId,
      userId: authSession.userId,
      role: 'user',
      content,
    });

    // Get conversation history (last 10 messages)
    const previousMessages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const conversationHistory = previousMessages
      .reverse()
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

    // Detect if user is asking about a specific section
    const detectedSection = detectResumeSection(content);
    let contextText = resumeText;

    if (detectedSection) {
      contextText = extractSection(resumeText, detectedSection);
    }

    // Prepare RAG context
    const { context, sources, systemPrompt } = prepareChatContext(
      contextText,
      content,
      conversationHistory
    );

    // Build messages for Groq
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (exclude system messages)
    conversationHistory
      .filter(msg => msg.role !== 'system')
      .slice(-6) // Last 3 exchanges
      .forEach(msg => {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      });

    // Add current user message
    messages.push({ role: 'user', content });

    const startTime = Date.now();

    // Generate AI response
    const completion = await generateChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 1024,
    });

    const processingTime = Date.now() - startTime;
    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save AI message
    const aiMessage = await ChatMessage.create({
      sessionId,
      userId: authSession.userId,
      role: 'assistant',
      content: aiResponse,
      sources: sources.map(s => ({
        text: s.text.substring(0, 500), // Limit source text length
        relevanceScore: s.relevanceScore,
        section: detectedSection || undefined,
      })),
      metadata: {
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        processingTime,
        temperature: 0.7,
      },
    });

    // Update session
    await ChatSession.findByIdAndUpdate(sessionId, {
      $inc: { messageCount: 2 }, // User message + AI response
      $set: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        userMessage,
        aiMessage,
      },
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/messages?sessionId=xxx
 * Get messages for a session
 */
export async function GET(req: NextRequest) {
  try {
    const authSession = await getSession();
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify session belongs to user
    const chatSession = await ChatSession.findOne({
      _id: sessionId,
      userId: authSession.userId,
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', message: error.message },
      { status: 500 }
    );
  }
}
