import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Default model
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Available models
export const GROQ_MODELS = {
  LLAMA_70B: 'llama-3.3-70b-versatile',
  LLAMA_8B: 'llama-3.1-8b-instant',
  MIXTRAL: 'mixtral-8x7b-32768',
} as const;

/**
 * Generate chat completion with Groq
 */
export async function generateChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
  } = {}
) {
  try {
    const completion = await groq.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      top_p: options.top_p ?? 1,
      stream: options.stream ?? false,
    });

    return completion;
  } catch (error: any) {
    console.error('Groq API error:', error);
    throw new Error(`Groq API error: ${error.message}`);
  }
}

/**
 * Generate streaming chat completion
 */
export async function generateStreamingCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
) {
  try {
    const stream = await groq.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      stream: true,
    });

    return stream;
  } catch (error: any) {
    console.error('Groq streaming error:', error);
    throw new Error(`Groq streaming error: ${error.message}`);
  }
}

/**
 * Generate text from prompt
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const completion = await generateChatCompletion(messages, options);
  
  return completion.choices[0]?.message?.content || '';
}

/**
 * Generate JSON response
 */
export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt?: string,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<T> {
  const fullSystemPrompt = systemPrompt
    ? `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. Do not include any text before or after the JSON.`
    : 'Respond with valid JSON only. Do not include any text before or after the JSON.';

  const response = await generateText(prompt, fullSystemPrompt, {
    ...options,
    temperature: options.temperature ?? 0.3, // Lower temperature for structured output
  });

  try {
    // Try to parse the response as JSON
    return JSON.parse(response);
  } catch (error) {
    // If parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Last resort: try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    
    throw new Error('Failed to parse JSON response from Groq');
  }
}

/**
 * Analyze resume content with Groq
 */
export async function analyzeResumeContent(
  resumeText: string,
  analysisType: 'skills' | 'experience' | 'education' | 'summary' | 'all' = 'all'
): Promise<any> {
  const systemPrompt = `You are an expert resume analyzer. Analyze the provided resume and extract structured information.`;
  
  const prompt = `Analyze this resume and extract ${analysisType === 'all' ? 'all relevant information' : analysisType}:

${resumeText}

Provide your analysis in JSON format.`;

  return generateJSON(prompt, systemPrompt);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export default groq;
