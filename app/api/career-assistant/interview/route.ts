import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import User from '@/models/User';
import { extractResumeText, extractSkills } from '@/lib/resume/resumeTextExtractor';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/interview
 * Generate personalized interview questions
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobRole, difficulty, count } = body;

    if (!jobRole) {
      return NextResponse.json(
        { error: 'Job role is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user's skills and experience
    const user = await User.findById(session.userId).lean();
    const skills = extractSkills(user || {}).join(', ') || 'general skills';
    const experience = user?.resume?.parsedData?.workHistory || [];

    const difficultyLevel = difficulty || 'medium';
    const questionCount = count || 10;

    const systemPrompt = `You are an expert technical interviewer and career coach.
Generate realistic, role-specific interview questions based on the candidate's experience and skills.`;

    const prompt = `Generate ${questionCount} interview questions for a ${jobRole} position.
Candidate Skills: ${skills}
Difficulty Level: ${difficultyLevel}

Provide a JSON response with:
{
  "questions": [
    {
      "category": "technical" | "behavioral" | "situational" | "project-based",
      "difficulty": "easy" | "medium" | "hard",
      "question": "The interview question",
      "hints": ["hint1", "hint2"],
      "keyPoints": ["point1", "point2"]
    }
  ]
}

Categories:
- Technical: Programming, algorithms, system design, technical concepts
- Behavioral: Past experiences, teamwork, conflict resolution
- Situational: Hypothetical scenarios, problem-solving approaches
- Project-based: Specific to candidate's experience and projects

Make questions realistic and relevant to the candidate's skill level and experience.`;

    const startTime = Date.now();
    const response = await generateJSON(prompt, systemPrompt, {
      temperature: 0.8,
      max_tokens: 2048,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        jobRole,
        difficulty: difficultyLevel,
        questions: response.questions || [],
        processingTime,
      },
      message: 'Interview questions generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating interview questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate interview questions', message: error.message },
      { status: 500 }
    );
  }
}
