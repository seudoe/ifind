import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyAuth } from '@/lib/auth';
import User from '@/models/User';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/projects
 * Generate project suggestions based on skills gaps
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetRole, level, count } = body;

    if (!targetRole) {
      return NextResponse.json(
        { error: 'Target role is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user's current skills
    const user = await User.findById(authResult.user._id).lean();
    const currentSkills = user?.extractedSkills?.map((s: any) => s.skill).join(', ') || 'basic programming';

    const projectLevel = level || 'intermediate';
    const projectCount = count || 5;

    const systemPrompt = `You are an expert career advisor and technical mentor.
Generate practical project ideas that help candidates build portfolio and learn new skills relevant to their target role.`;

    const prompt = `Generate ${projectCount} project suggestions for someone targeting a ${targetRole} position.
Current Skills: ${currentSkills}
Project Complexity: ${projectLevel}

Provide a JSON response with:
{
  "projects": [
    {
      "title": "Project name",
      "description": "Brief description (2-3 sentences)",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "duration": "Estimated time to complete",
      "skills": ["skill1", "skill2", "skill3"],
      "technologies": ["tech1", "tech2"],
      "learningOutcomes": ["outcome1", "outcome2"],
      "keyFeatures": ["feature1", "feature2", "feature3"],
      "portfolioImpact": "How this project strengthens portfolio"
    }
  ]
}

Focus on:
- Projects that address skill gaps for the target role
- Practical, portfolio-worthy projects
- Clear learning outcomes
- Modern technologies and best practices
- Realistic scope for the difficulty level`;

    const startTime = Date.now();
    const response = await generateJSON(prompt, systemPrompt, {
      temperature: 0.8,
      max_tokens: 2048,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        targetRole,
        level: projectLevel,
        currentSkills,
        projects: response.projects || [],
        processingTime,
      },
      message: 'Project suggestions generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating project suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate project suggestions', message: error.message },
      { status: 500 }
    );
  }
}
