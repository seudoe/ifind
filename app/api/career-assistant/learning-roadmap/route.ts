import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import User from '@/models/User';
import { extractResumeText, extractSkills } from '@/lib/resume/resumeTextExtractor';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/learning-roadmap
 * Generate personalized learning roadmap
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetSkills, timeframe, currentLevel } = body;

    if (!targetSkills || targetSkills.length === 0) {
      return NextResponse.json(
        { error: 'Target skills are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user's current skills
    const user = await User.findById(session.userId).lean();
    const currentSkills = extractSkills(user || {}).join(', ') || 'beginner level';

    const learningTimeframe = timeframe || '3-6 months';
    const skillLevel = currentLevel || 'beginner';

    const systemPrompt = `You are an expert learning architect and technical educator.
Create comprehensive, structured learning roadmaps with clear phases, resources, and milestones.`;

    const prompt = `Create a detailed learning roadmap to master these skills: ${targetSkills.join(', ')}

Current Skills: ${currentSkills}
Current Level: ${skillLevel}
Timeframe: ${learningTimeframe}

Provide a JSON response with:
{
  "roadmap": {
    "title": "Learning roadmap title",
    "overview": "Brief overview of learning path",
    "totalDuration": "Estimated total time",
    "phases": [
      {
        "phase": "Phase number and name",
        "duration": "Time for this phase",
        "focus": "Main focus areas",
        "topics": [
          {
            "topic": "Topic name",
            "subtopics": ["subtopic1", "subtopic2"],
            "resources": [
              {
                "type": "course" | "book" | "video" | "article" | "project" | "documentation",
                "title": "Resource title",
                "provider": "Platform or author",
                "url": "URL if available",
                "duration": "Time to complete"
              }
            ],
            "practiceProjects": ["project1", "project2"]
          }
        ],
        "milestones": ["milestone1", "milestone2"],
        "assessmentCriteria": ["criteria1", "criteria2"]
      }
    ],
    "prerequisites": ["prereq1", "prereq2"],
    "nextSteps": ["next1", "next2"]
  }
}

Structure with 3-4 phases (Foundation, Intermediate, Advanced, Mastery).
Include mix of free and paid resources.
Focus on practical, hands-on learning.`;

    const startTime = Date.now();
    const response = await generateJSON(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 3000,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        targetSkills,
        timeframe: learningTimeframe,
        currentLevel: skillLevel,
        roadmap: response.roadmap,
        processingTime,
      },
      message: 'Learning roadmap generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating learning roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to generate learning roadmap', message: error.message },
      { status: 500 }
    );
  }
}
