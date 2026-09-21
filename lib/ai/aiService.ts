/**
 * Universal AI Service for iFind
 * Uses Groq when available (cost-effective), falls back to Gemini
 */

import groqService from '../groq/groqService';
import geminiService from '../resume/geminiService';

/**
 * Check if Groq is available and configured
 */
export function isGroqAvailable(): boolean {
    const apiKey = process.env.GROQ_API_KEY;
    return Boolean(apiKey && apiKey !== 'your_groq_api_key_here' && apiKey.length > 10);
}

/**
 * Check if Gemini is available and configured
 */
export function isGeminiAvailable(): boolean {
    return geminiService.isGeminiAvailable();
}

/**
 * Get the active AI provider
 */
export function getActiveProvider(): 'groq' | 'gemini' | 'none' {
    if (isGroqAvailable()) return 'groq';
    if (isGeminiAvailable()) return 'gemini';
    return 'none';
}

/**
 * Universal chat function that uses best available provider
 * @param prompt - The user prompt
 * @param conversationHistory - Previous messages (for Groq)
 * @param expectJSON - Whether to expect JSON response
 * @returns AI response (parsed JSON or string)
 */
export async function chat(
    prompt: string,
    conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [],
    expectJSON: boolean = false
): Promise<any> {
    const provider = getActiveProvider();

    console.log(`[AIService] Using provider: ${provider}`);

    if (provider === 'none') {
        throw new Error('No AI provider available. Please configure GROQ_API_KEY or GEMINI_API_KEY');
    }

    try {
        if (provider === 'groq') {
            // Use Groq
            const messages = [...conversationHistory, { role: 'user' as const, content: prompt }];
            
            if (expectJSON) {
                // Add JSON instruction to system message
                const hasSystem = messages.some(m => m.role === 'system');
                if (hasSystem) {
                    messages.forEach(m => {
                        if (m.role === 'system') {
                            m.content += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code blocks, just pure JSON.';
                        }
                    });
                } else {
                    messages.unshift({
                        role: 'system',
                        content: 'Respond with valid JSON only. No markdown, no code blocks, just pure JSON.'
                    });
                }
            }

            const completion = await groqService.generateChatCompletion(messages, {
                temperature: expectJSON ? 0.3 : 0.7,
                max_tokens: expectJSON ? 4096 : 2048,
            });

            const response = completion.choices[0]?.message?.content || '';

            if (expectJSON) {
                return parseJSONResponse(response);
            }

            return response;
        } else {
            // Use Gemini
            return await geminiService.generateContent(prompt, expectJSON);
        }
    } catch (error: any) {
        console.error(`[AIService] ${provider} failed:`, error.message);
        
        // If Groq failed and Gemini is available, try Gemini as fallback
        if (provider === 'groq' && isGeminiAvailable()) {
            console.log('[AIService] Falling back to Gemini...');
            try {
                return await geminiService.generateContent(prompt, expectJSON);
            } catch (geminiError: any) {
                console.error('[AIService] Gemini fallback also failed:', geminiError.message);
                throw new Error(`Both AI providers failed. Groq: ${error.message}, Gemini: ${geminiError.message}`);
            }
        }

        throw error;
    }
}

/**
 * Parse JSON from AI response, handling markdown code blocks
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
        
        // Try array match
        const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                return JSON.parse(arrayMatch[0]);
            } catch (e: any) {
                throw new Error(`Failed to parse JSON array: ${e.message}`);
            }
        }
        
        throw new Error('No valid JSON found in response');
    }
}

/**
 * Generate text without expecting JSON
 */
export async function generateText(prompt: string): Promise<string> {
    return chat(prompt, [], false);
}

/**
 * Generate JSON response
 */
export async function generateJSON<T = any>(prompt: string): Promise<T> {
    return chat(prompt, [], true);
}

export default {
    chat,
    generateText,
    generateJSON,
    isGroqAvailable,
    isGeminiAvailable,
    getActiveProvider,
};
