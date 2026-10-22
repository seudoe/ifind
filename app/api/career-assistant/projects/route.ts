import { int, str, strList } from '@/lib/validate';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import User from '@/models/User';
import { extractResumeText, extractSkills } from '@/lib/resume/resumeTextExtractor';
import { generateJSON } from '@/lib/groq/groqService';
import { withBilling } from '@/lib/usage/withBilling';

/**
 * POST /api/career-assistant/projects
 * Generate project suggestions based on skills gaps
 */
async function handlePost(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetRole = str(body?.targetRole, 120);
    const level = str(body?.level, 40);
    const count = int(body?.count, 1, 10, 5);

    if (!targetRole) {
      return NextResponse.json(
        { error: 'Target role is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user's current skills
    const user = await User.findById(session.userId).lean();
    const currentSkills = extractSkills(user || {}).join(', ') || 'basic programming';

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
  } catch (error) {
    console.error('Error generating project suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate project suggestions' },
      { status: 500 }
    );
  }
}

export const POST = withBilling('projects', handlePost);
