/**
 * Recommendation Engine Core
 * 
 * Main recommendation generation logic. This module orchestrates
 * the recommendation pipeline: retrieval, scoring, filtering, and ranking.
 * 
 * Now supports pluggable retrieval strategies through the Strategy Pattern.
 */

import { getDefaultStrategy } from "./strategies";
import { computeSimilarityScore } from "./scoring";
import type {
  GenerateRecommendationsParams,
  RecommendationConfig,
  RecommendationResult,
  ScoredRecommendation,
} from "./types";
import type { RecommendationStrategy } from "./strategies";

/**
 * Default recommendation configuration
 */
const DEFAULT_CONFIG: RecommendationConfig = {
  tfidfWeight: 0.4,
  bertWeight: 0.6,
  topN: 20,
  threshold: 0.1,
};

/**
 * Generate personalized internship recommendations for a user
 * 
 * This is the main entry point for recommendation generation.
 * It handles the complete recommendation pipeline:
 * 1. Retrieve candidate internships (using pluggable strategy)
 * 2. Score each candidate against user vectors
 * 3. Filter by threshold
 * 4. Sort by score (descending)
 * 5. Return top N recommendations
 * 
 * @param params - Generation parameters including user vectors and config
 * @param strategy - Optional custom strategy (uses default if not provided)
 * @returns Recommendation result with scored recommendations and metadata
 */
export async function generateRecommendations(
  params: GenerateRecommendationsParams,
  strategy?: RecommendationStrategy
): Promise<RecommendationResult> {
  const startTime = Date.now();
  const { userVectors, config: userConfig } = params;
  
  // Merge user config with defaults
  const config: RecommendationConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  // Validate config weights sum to 1.0 (with tolerance for floating point)
  const weightSum = config.tfidfWeight + config.bertWeight;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    console.warn(
      `[recommendation-engine] Weight sum is ${weightSum}, expected 1.0. ` +
      `Using provided weights anyway.`
    );
  }

  // Get strategy (use provided or get default)
  const activeStrategy = strategy || (await getDefaultStrategy());
  console.log(`[recommendation-engine] Using strategy: ${activeStrategy.name}`);

  // Step 1: Retrieve candidate internships using strategy
  const retrievalStart = Date.now();
  const candidates = await activeStrategy.retrieveCandidates({
    userVectors,
    limit: config.topN * 2, // Retrieve more than needed for better filtering
  });
  const retrievalTime = Date.now() - retrievalStart;
  console.log(`[recommendation-engine] Candidate retrieval took ${retrievalTime}ms`);

  // Step 2: Score all candidates
  const scoringStart = Date.now();
  const scored: ScoredRecommendation[] = candidates.map((candidate) => ({
    id: candidate._id,
    score: computeSimilarityScore(
      userVectors.tfidf,
      userVectors.bert,
      candidate.tfidf_vector,
      candidate.bert_vector,
      config.tfidfWeight,
      config.bertWeight
    ),
  }));
  const scoringTime = Date.now() - scoringStart;
  console.log(`[recommendation-engine] Cosine similarity scoring took ${scoringTime}ms`);

  // Step 3: Filter by threshold
  const filtered = scored.filter((item) => item.score >= config.threshold);

  // Step 4: Sort by score (descending)
  const sorted = filtered.sort((a, b) => b.score - a.score);

  // Step 5: Take top N
  const recommendations = sorted.slice(0, config.topN);

  const totalTime = Date.now() - startTime;
  console.log(
    `[recommendation-engine] Generated ${recommendations.length} recommendations ` +
    `from ${candidates.length} candidates (filtered from ${scored.length}) in ${totalTime}ms`
  );
  console.log(
    `[recommendation-engine] Pipeline breakdown: ` +
    `retrieval=${retrievalTime}ms, scoring=${scoringTime}ms, total=${totalTime}ms`
  );

  return {
    recommendations,
    config,
    candidatesEvaluated: candidates.length,
  };
}
