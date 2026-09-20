import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import JobDescription from '@/models/JobDescription';
import { getSession } from '@/lib/auth';
import { generateJSON } from '@/lib/groq/groqService';

/**
 * GET /api/job-descriptions
 * Get all job descriptions for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const jobDescriptions = await JobDescription.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: jobDescriptions,
    });
  } catch (error: any) {
    console.error('Error fetching job descriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job descriptions', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/job-descriptions
 * Create a new job description
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, company, description, location, employmentType, experienceLevel } = body;

    if (!title || !company || !description) {
      return NextResponse.json(
        { error: 'Title, company, and description are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Parse job description with AI to extract structured data
    let parsedData;
    try {
      const systemPrompt = `You are an expert at analyzing job descriptions. Extract structured information from job postings.`;
      
      const prompt = `Analyze this job description and extract the following information in JSON format:
{
  "technicalSkills": ["skill1", "skill2", ...],
  "softSkills": ["skill1", "skill2", ...],
  "tools": ["tool1", "tool2", ...],
  "certifications": ["cert1", "cert2", ...],
  "education": ["degree1", "degree2", ...],
  "requirements": ["req1", "req2", ...],
  "responsibilities": ["resp1", "resp2", ...],
  "preferredQualifications": ["qual1", "qual2", ...]
}

Job Title: ${title}
Company: ${company}

Description:
${description}`;

      parsedData = await generateJSON(prompt, systemPrompt, {
        temperature: 0.3,
        max_tokens: 2048,
      });
    } catch (parseError) {
      console.error('Error parsing job description with AI:', parseError);
      // Continue without parsed data
      parsedData = {
        technicalSkills: [],
        softSkills: [],
        tools: [],
        certifications: [],
        education: [],
      };
    }

    // Create job description
    const jobDescription = await JobDescription.create({
      userId: session.userId,
      title,
      company,
      description,
      location,
      employmentType: employmentType || 'full-time',
      experienceLevel: experienceLevel || 'mid',
      requirements: parsedData.requirements || [],
      responsibilities: parsedData.responsibilities || [],
      preferredQualifications: parsedData.preferredQualifications || [],
      skills: [
        ...(parsedData.technicalSkills || []),
        ...(parsedData.softSkills || []),
      ],
      parsedData: {
        technicalSkills: parsedData.technicalSkills || [],
        softSkills: parsedData.softSkills || [],
        tools: parsedData.tools || [],
        certifications: parsedData.certifications || [],
        education: parsedData.education || [],
      },
    });

    return NextResponse.json({
      success: true,
      data: jobDescription,
      message: 'Job description created successfully',
    });
  } catch (error: any) {
    console.error('Error creating job description:', error);
    return NextResponse.json(
      { error: 'Failed to create job description', message: error.message },
      { status: 500 }
    );
  }
}
