import Groq from 'groq-sdk';
import { recordLlmCall } from '../usage/context';

// Several Groq keys (limits are per key/organisation): requests are spread round-robin, and a key that is rate-limited or
// rejected is skipped for a while so the next one answers. Keys come from GROQ_API_KEYS (comma or whitespace separated),
// GROQ_API_KEY and GROQ_API_KEY_1, GROQ_API_KEY_2, ...
const clients = new Map<string, Groq>();
const coolUntil = new Map<string, number>();
let cursor = 0;

const PLACEHOLDER = 'your_groq_api_key_here';

export function groqKeys(): string[] {
  const raw = [
    ...(process.env.GROQ_API_KEYS ?? '').split(/[\s,]+/),
    process.env.GROQ_API_KEY ?? '',
    ...Object.entries(process.env).filter(([k]) => /^GROQ_API_KEY_\d+$/.test(k)).map(([, v]) => v ?? ''),
  ];
  return [...new Set(raw.map((k) => k.trim()).filter((k) => k.length > 10 && k !== PLACEHOLDER))];
}

export function groqAvailable(): boolean {
  return groqKeys().length > 0;
}

function clientFor(key: string): Groq {
  let c = clients.get(key);
  if (!c) clients.set(key, (c = new Groq({ apiKey: key })));
  return c;
}

/** Rate limit, quota or auth problem on this key (another key may still work). */
function keyProblem(error: any): { cooldownMs: number } | null {
  const status = Number(error?.status ?? error?.statusCode);
  const text = String(error?.message ?? '').toLowerCase();
  if (status === 429 || /rate.?limit|quota|tokens per|requests per/.test(text)) return { cooldownMs: 60_000 };
  if (status === 401 || status === 403 || /invalid api key|organization.*(restricted|disabled)/.test(text)) return { cooldownMs: 3_600_000 };
  return null;
}

/** Runs `fn` with a usable key, moving on to the next key when one is rate-limited or rejected. */
async function withKey<T>(fn: (client: Groq) => Promise<T>): Promise<T> {
  const keys = groqKeys();
  if (!keys.length) throw new Error('GROQ_API_KEY is not configured on the server');
  const now = Date.now();
  const start = cursor++ % keys.length;
  const order = keys.map((_, i) => keys[(start + i) % keys.length]);
  // keys on cooldown go last, so they are still tried when every key is limited
  order.sort((x, y) => Number((coolUntil.get(x) ?? 0) > now) - Number((coolUntil.get(y) ?? 0) > now));
  let lastError: unknown;
  for (const key of order) {
    try {
      return await fn(clientFor(key));
    } catch (error: any) {
      const problem = keyProblem(error);
      if (!problem) throw error;
      coolUntil.set(key, Date.now() + problem.cooldownMs);
      lastError = error;
    }
  }
  throw lastError;
}

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
): Promise<Groq.Chat.Completions.ChatCompletion> {
  const model = options.model || DEFAULT_MODEL;
  const startedAt = Date.now();
  try {
    const completion = await withKey((client) => client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      top_p: options.top_p ?? 1,
      stream: false, // Force stream to false for type safety
    }));

    recordLlmCall({
      provider: 'groq',
      model,
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      latencyMs: Date.now() - startedAt,
      ok: true,
    });
    return completion as Groq.Chat.Completions.ChatCompletion;
  } catch (error: any) {
    recordLlmCall({ provider: 'groq', model, latencyMs: Date.now() - startedAt, ok: false, error });
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
    const stream = await withKey((client) => client.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      stream: true,
    }));

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

