/**
 * Gemini AI Service for iFind
 * Handles all interactions with Google Gemini API for resume analysis
 * 
 * Ported from IPD Resume Analyzer - adapted for iFind's TypeScript environment
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Initialize Gemini AI client
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Initialize Gemini AI with API key from environment
 */
function initializeGemini(): GenerativeModel {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in environment variables');
    }

    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            },
        });
        console.log('[GeminiService] Initialized successfully');
    }

    return model!;
}

/**
 * Check if Gemini is available and configured
 */
export function isGeminiAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks
 */
function parseJSONResponse(text: string): any {
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/```\s*$/, '');

    try {
        return JSON.parse(cleanedText);
    } catch (error) {
        // Try to find JSON in the text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e: any) {
                throw new Error(`Failed to parse JSON: ${e.message}`);
            }
        }
        throw new Error('No valid JSON found in response');
    }
}

/**
 * Estimate token count for prompt (rough estimate: 1 token ≈ 4 chars)
 */
function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Generate content using Gemini AI with retry logic
 * @param prompt - The prompt to send to Gemini
 * @param expectJSON - Whether to expect JSON response (default: true)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Parsed response or raw text
 */
export async function generateContent(
    prompt: string,
    expectJSON: boolean = true,
    maxRetries: number = 3
): Promise<any> {
    if (!isGeminiAvailable()) {
        throw new Error('Gemini AI not available - GEMINI_API_KEY not configured');
    }

    // Check prompt size
    const estimatedTokens = estimateTokenCount(prompt);
    const maxTokens = 30000; // Gemini Flash limit
    
    if (estimatedTokens > maxTokens) {
        console.warn(`[GeminiService] Prompt is large: ~${estimatedTokens} tokens`);
    }

    const aiModel = initializeGemini();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[GeminiService] Request attempt ${attempt + 1}/${maxRetries + 1}`);

            // Generate content
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`[GeminiService] Response received successfully`);

            // If expecting JSON, parse it
            if (expectJSON) {
                try {
                    const parsed = parseJSONResponse(text);
                    console.log(`[GeminiService] JSON parsed successfully`);
                    return parsed;
                } catch (parseError: any) {
                    lastError = parseError;
                    console.warn(`[GeminiService] JSON parsing failed on attempt ${attempt + 1}: ${parseError.message}`);

                    // If this is not the last attempt, retry with explicit instructions
                    if (attempt < maxRetries) {
                        console.log(`[GeminiService] Retrying with explicit JSON instructions...`);
                        const retryPrompt = `${prompt}\n\nREMINDER: Your response MUST be ONLY valid JSON. No markdown, no explanations, no code blocks. Just pure JSON starting with { and ending with }.`;

                        const retryResult = await aiModel.generateContent(retryPrompt);
                        const retryResponse = await retryResult.response;
                        const retryText = retryResponse.text();

                        try {
                            const parsed = parseJSONResponse(retryText);
                            console.log(`[GeminiService] JSON parsed successfully on retry`);
                            return parsed;
                        } catch (retryParseError: any) {
                            lastError = retryParseError;
                            console.error(`[GeminiService] JSON parsing failed again: ${retryParseError.message}`);
                        }
                    }
                }
            } else {
                // Return raw text if not expecting JSON
                return text;
            }
        } catch (error: any) {
            lastError = error;
            console.error(`[GeminiService] Error on attempt ${attempt + 1}:`, error.message);

            // If this is not the last attempt, wait before retrying (exponential backoff)
            if (attempt < maxRetries) {
                const waitTime = 1000 * (attempt + 1);
                console.log(`[GeminiService] Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    // All attempts failed
    const errorMessage = lastError
        ? `Gemini AI failed after ${maxRetries + 1} attempts: ${lastError.message}`
        : 'Gemini AI failed with unknown error';

    console.error(`[GeminiService] ${errorMessage}`);
    throw new Error(errorMessage);
}

/**
 * Generate text using Gemini (alias for generateContent with expectJSON=false)
 */
export async function generateText(prompt: string): Promise<string> {
    return generateContent(prompt, false);
}

/**
 * Test Gemini connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    if (!isGeminiAvailable()) {
        return {
            success: false,
            message: 'Gemini API key not configured',
        };
    }

    try {
        const testPrompt = 'Respond with only this JSON: {"status": "ok", "message": "Connection successful"}';
        const result = await generateContent(testPrompt, true);

        return {
            success: true,
            message: 'Gemini AI connection successful',
            data: result,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Gemini AI connection failed: ${error.message}`,
        };
    }
}

/**
 * Get model information
 */
export function getModelInfo(): { available: boolean; model: string } {
    return {
        available: isGeminiAvailable(),
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    };
}

export default {
    generateContent,
    generateText,
    testConnection,
    getModelInfo,
    isGeminiAvailable,
};
