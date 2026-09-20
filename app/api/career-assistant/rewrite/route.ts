import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyAuth } from '@/lib/auth';
import { generateText } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/rewrite
 * Rewrite resume content with different tones
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { content, tone, context } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content to rewrite is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const toneInstructions: Record<string, string> = {
      professional: 'Use formal, business-appropriate language. Focus on achievements and measurable results. Use action verbs and quantifiable metrics.',
      creative: 'Use engaging, dynamic language that showcases personality while maintaining professionalism. Be innovative and expressive.',
      technical: 'Use precise technical terminology and industry jargon. Focus on technical skills, methodologies, and tools. Be specific about technologies used.',
      executive: 'Use high-level strategic language. Focus on leadership, vision, and business impact. Emphasize decision-making and organizational influence.',
    };

    const selectedTone = tone || 'professional';
    const toneInstruction = toneInstructions[selectedTone] || toneInstructions.professional;

    const systemPrompt = `You are an expert resume writer specializing in crafting compelling, ATS-friendly resume content.
Your task is to rewrite resume bullet points and descriptions to make them more impactful and professional.

Guidelines:
- ${toneInstruction}
- Use the STAR method when applicable (Situation, Task, Action, Result)
- Quantify achievements wherever possible
- Start with strong action verbs
- Keep bullet points concise (1-2 lines)
- Focus on impact and results, not just responsibilities
- Make it ATS-friendly with relevant keywords
- Preserve the core meaning and facts`;

    const prompt = `Rewrite the following resume content with a ${selectedTone} tone:

${context ? `Context: ${context}\n\n` : ''}Original Content:
${content}

Provide the rewritten version that is more impactful, professional, and achievement-focused.`;

    const startTime = Date.now();
    const rewrittenContent = await generateText(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 1024,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        original: content,
        rewritten: rewrittenContent,
        tone: selectedTone,
        processingTime,
      },
      message: 'Content rewritten successfully',
    });
  } catch (error: any) {
    console.error('Error rewriting content:', error);
    return NextResponse.json(
      { error: 'Failed to rewrite content', message: error.message },
      { status: 500 }
    );
  }
}
