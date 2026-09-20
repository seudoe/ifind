import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/star
 * Transform vague experiences into STAR format
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { experience, role, company } = body;

    if (!experience) {
      return NextResponse.json(
        { error: 'Experience description is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const systemPrompt = `You are an expert career coach specializing in the STAR method (Situation, Task, Action, Result).
Transform vague experience descriptions into compelling STAR format stories that showcase achievements and impact.

Guidelines:
- Situation: Set the context and background
- Task: Describe the challenge or responsibility
- Action: Detail specific actions taken
- Result: Quantify outcomes and impact with metrics when possible
- Use strong action verbs
- Focus on individual contributions
- Make results measurable and impressive`;

    const prompt = `Transform this experience into a compelling STAR format story:

${role ? `Role: ${role}\n` : ''}${company ? `Company: ${company}\n` : ''}
Experience:
${experience}

Provide a JSON response with:
{
  "situation": "Context and background (2-3 sentences)",
  "task": "Challenge or responsibility (1-2 sentences)",
  "action": "Specific actions taken (3-4 bullet points)",
  "result": "Quantified outcomes and impact (2-3 bullet points with metrics)",
  "bulletPoint": "Single powerful bullet point combining all elements"
}`;

    const startTime = Date.now();
    const starStory = await generateJSON(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 1024,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        original: experience,
        star: starStory,
        processingTime,
      },
      message: 'STAR story generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating STAR story:', error);
    return NextResponse.json(
      { error: 'Failed to generate STAR story', message: error.message },
      { status: 500 }
    );
  }
}
