/**
 * Recommendation Service
 * 
 * Public API for the recommendation system.
 * This module provides the main entry points for generating
 * and persisting user recommendations.
 * 
 * Now supports pluggable retrieval strategies.
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { generateRecommendations } from "./engine";
import type { VectorEmbeddings, RecommendationConfig } from "./types";
import type { RecommendationStrategy } from "./strategies";

/**
 * Generate and persist recommendations for a specific user
 * 
 * This is the main public interface for the recommendation system.
 * It generates recommendations and updates the user's document in MongoDB.
 * 
 * @param userId - The user's MongoDB ObjectId
 * @param userVectors - The user's TF-IDF and BERT vectors
 * @param config - Optional configuration overrides
 * @param strategy - Optional custom retrieval strategy (uses default if not provided)
 * @returns True if recommendations were successfully generated and saved
 */
export async function generateAndSaveRecommendations(
  userId: string,
  userVectors: VectorEmbeddings,
  config?: Partial<RecommendationConfig>,
  strategy?: RecommendationStrategy
): Promise<boolean> {
  try {
    // Generate recommendations (with optional custom strategy)
    const result = await generateRecommendations(
      {
        userVectors,
        config,
      },
      strategy
    );

    // Save to database
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      console.error("[recommendation-service] Database connection not available");
      return false;
    }

    const userOid = new mongoose.Types.ObjectId(userId);
    
    // Update user document with recommendations
    await db.collection("users").updateOne(
      { _id: userOid },
      {
        $set: {
          "recommendedInternships.updatedAt": new Date(),
          "recommendedInternships.recommendedList": result.recommendations.map((r) => r.id),
          "recommendedInternships.recommendedScores": result.recommendations.map((r) => ({
            id: r.id,
            score: Math.round(r.score * 1000) / 1000, // Round to 3 decimal places
          })),
        },
      }
    );

    console.log(
      `[recommendation-service] Generated ${result.recommendations.length} recommendations ` +
      `for user ${userId} (evaluated ${result.candidatesEvaluated} candidates)`
    );

    return true;
  } catch (err) {
    console.error("[recommendation-service] Error generating recommendations:", err);
    return false;
  }
}

// Re-export types and strategies for convenience
export type { VectorEmbeddings, RecommendationConfig, ScoredRecommendation } from "./types";
export type { RecommendationStrategy, StrategyContext } from "./strategies";
export { StrategyType, StrategyFactory, getDefaultStrategy } from "./strategies";
