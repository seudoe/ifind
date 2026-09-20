import { cosineSimilarity } from '@/lib/groq/groqService';

interface TextChunk {
  text: string;
  section?: string;
  startIndex: number;
  endIndex: number;
}

interface ScoredChunk extends TextChunk {
  score: number;
}

/**
 * Split text into chunks for better semantic search
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkText = chunkWords.join(' ');
    
    if (chunkText.trim().length > 0) {
      chunks.push({
        text: chunkText,
        startIndex: i,
        endIndex: i + chunkWords.length,
      });
    }
    
    if (i + chunkSize >= words.length) break;
  }
  
  return chunks;
}

/**
 * Simple text-based embedding using TF-IDF-like approach
 * This is a fallback for when vector embeddings are not available
 */
export function createSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().match(/\w+/g) || [];
  const wordFreq: Record<string, number> = {};
  
  // Count word frequencies
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Create a fixed-size vector (using top 100 most common words)
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);
  
  const embedding = new Array(100).fill(0);
  sortedWords.forEach(([word, freq], idx) => {
    embedding[idx] = freq / words.length; // Normalize
  });
  
  return embedding;
}

/**
 * Calculate keyword-based similarity between two texts
 */
export function calculateKeywordSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().match(/\w+/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\w+/g) || []);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  ]);
  
  const filtered1 = new Set([...words1].filter(w => !stopWords.has(w) && w.length > 2));
  const filtered2 = new Set([...words2].filter(w => !stopWords.has(w) && w.length > 2));
  
  // Calculate Jaccard similarity
  const intersection = new Set([...filtered1].filter(x => filtered2.has(x)));
  const union = new Set([...filtered1, ...filtered2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Find most relevant chunks using keyword similarity
 */
export function findRelevantChunks(
  query: string,
  chunks: TextChunk[],
  topK: number = 3
): ScoredChunk[] {
  const scoredChunks: ScoredChunk[] = chunks.map(chunk => ({
    ...chunk,
    score: calculateKeywordSimilarity(query, chunk.text),
  }));
  
  // Sort by score and return top K
  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extract relevant context from resume for RAG
 */
export function extractRelevantContext(
  resumeText: string,
  query: string,
  maxChunks: number = 3
): Array<{ text: string; relevanceScore: number; section?: string }> {
  // Split resume into chunks
  const chunks = chunkText(resumeText, 400, 80);
  
  // Find most relevant chunks
  const relevantChunks = findRelevantChunks(query, chunks, maxChunks);
  
  // Filter out chunks with very low scores
  return relevantChunks
    .filter(chunk => chunk.score > 0.1)
    .map(chunk => ({
      text: chunk.text,
      relevanceScore: Math.round(chunk.score * 100) / 100,
      section: chunk.section,
    }));
}

/**
 * Build RAG context from resume and query
 */
export function buildRAGContext(
  resumeText: string,
  query: string,
  includeFullResume: boolean = false
): string {
  if (includeFullResume || resumeText.length < 2000) {
    // If resume is short, include everything
    return resumeText;
  }
  
  // Extract relevant sections
  const relevantSections = extractRelevantContext(resumeText, query, 4);
  
  if (relevantSections.length === 0) {
    // Fallback to first part of resume
    return resumeText.substring(0, 2000);
  }
  
  // Combine relevant sections
  return relevantSections
    .map((section, idx) => `[Section ${idx + 1}]\n${section.text}`)
    .join('\n\n');
}

/**
 * Prepare context for chat with metadata
 */
export function prepareChatContext(
  resumeText: string,
  query: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): {
  context: string;
  sources: Array<{ text: string; relevanceScore: number }>;
  systemPrompt: string;
} {
  const relevantSections = extractRelevantContext(resumeText, query, 3);
  
  const context = relevantSections.length > 0
    ? relevantSections.map(s => s.text).join('\n\n')
    : resumeText.substring(0, 2000);
  
  const systemPrompt = `You are an AI assistant helping users understand and improve their resume. 
You have access to the user's resume content and should provide accurate, helpful answers based on that information.

Context from Resume:
${context}

Guidelines:
- Answer based on the resume content provided
- Be specific and reference actual details from the resume
- If information is not in the resume, say so honestly
- Provide constructive suggestions when appropriate
- Keep responses concise and actionable`;
  
  return {
    context,
    sources: relevantSections,
    systemPrompt,
  };
}

/**
 * Detect if a query is asking about specific resume sections
 */
export function detectResumeSection(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('skill') || lowerQuery.includes('technical')) {
    return 'skills';
  }
  if (lowerQuery.includes('experience') || lowerQuery.includes('work') || lowerQuery.includes('job')) {
    return 'experience';
  }
  if (lowerQuery.includes('education') || lowerQuery.includes('degree') || lowerQuery.includes('university')) {
    return 'education';
  }
  if (lowerQuery.includes('project')) {
    return 'projects';
  }
  if (lowerQuery.includes('certification') || lowerQuery.includes('certificate')) {
    return 'certifications';
  }
  
  return null;
}

/**
 * Extract specific section from resume text
 */
export function extractSection(resumeText: string, section: string): string {
  const lines = resumeText.split('\n');
  const sectionKeywords: Record<string, string[]> = {
    skills: ['skills', 'technical skills', 'competencies', 'technologies'],
    experience: ['experience', 'work experience', 'employment', 'work history'],
    education: ['education', 'academic', 'qualification'],
    projects: ['projects', 'portfolio'],
    certifications: ['certifications', 'certificates', 'licenses'],
  };
  
  const keywords = sectionKeywords[section] || [];
  let inSection = false;
  let sectionText = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Check if line is a section header
    const isHeader = keywords.some(keyword => 
      line.includes(keyword) && line.length < 50
    );
    
    if (isHeader) {
      inSection = true;
      sectionText += lines[i] + '\n';
      continue;
    }
    
    // Check if we've hit another section
    if (inSection && line.length < 50 && /^[A-Z\s]+$/.test(lines[i])) {
      break;
    }
    
    if (inSection) {
      sectionText += lines[i] + '\n';
    }
  }
  
  return sectionText || resumeText.substring(0, 1000);
}
