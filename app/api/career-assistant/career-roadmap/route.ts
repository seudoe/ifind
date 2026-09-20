import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyAuth } from '@/lib/auth';
import User from '@/models/User';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * POST /api/career-assistant/career-roadmap
 * Generate 5-year career progression roadmap
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { currentRole, targetRole, industry, yearsOfExperience } = body;

    if (!currentRole || !targetRole) {
      return NextResponse.json(
        { error: 'Current role and target role are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user's current skills and experience
    const user = await User.findById(authResult.user._id).lean();
    const currentSkills = user?.extractedSkills?.map((s: any) => s.skill).join(', ') || 'entry-level skills';

    const experience = yearsOfExperience || 0;
    const targetIndustry = industry || 'Technology';

    const systemPrompt = `You are an expert career strategist and executive coach.
Create realistic, actionable 5-year career progression plans from current to target roles.`;

    const prompt = `Create a detailed 5-year career roadmap:

Current Role: ${currentRole}
Target Role: ${targetRole}
Industry: ${targetIndustry}
Years of Experience: ${experience}
Current Skills: ${currentSkills}

Provide a JSON response with:
{
  "roadmap": {
    "title": "Career progression title",
    "overview": "Strategic overview of career path",
    "years": [
      {
        "year": 1-5,
        "yearLabel": "Year 1" or "Years 1-2",
        "targetRole": "Role to aim for in this period",
        "focus": "Primary focus areas",
        "skillsToAcquire": [
          {
            "skill": "Skill name",
            "importance": "critical" | "important" | "nice-to-have",
            "howToLearn": "Learning approach"
          }
        ],
        "experienceGoals": ["goal1", "goal2"],
        "certifications": ["cert1", "cert2"],
        "networkingGoals": ["goal1", "goal2"],
        "keyMilestones": ["milestone1", "milestone2"],
        "salaryRange": {
          "min": number,
          "max": number,
          "currency": "USD"
        },
        "roleResponsibilities": ["resp1", "resp2"]
      }
    ],
    "criticalTransitions": [
      {
        "from": "Current role",
        "to": "Next role",
        "challenges": ["challenge1", "challenge2"],
        "strategies": ["strategy1", "strategy2"]
      }
    ],
    "alternativePaths": ["path1", "path2"],
    "risksMitigation": ["risk/mitigation1", "risk/mitigation2"],
    "successMetrics": ["metric1", "metric2"]
  }
}

Make it realistic with clear action items.
Include salary progressions based on market data.
Address potential challenges and how to overcome them.`;

    const startTime = Date.now();
    const response = await generateJSON(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 3000,
    });
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        currentRole,
        targetRole,
        industry: targetIndustry,
        roadmap: response.roadmap,
        processingTime,
      },
      message: 'Career roadmap generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating career roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to generate career roadmap', message: error.message },
      { status: 500 }
    );
  }
}
