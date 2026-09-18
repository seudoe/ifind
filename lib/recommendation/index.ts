/**
 * Recommendation Service
 * 
 * Public API for the recommendation system.
 * This module provides the main entry points for generating
 * and persisting user recommendations.
 * 
 * Now supports pluggable retrieval strategies and caching.
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { generateRecommendations } from "./engine";
import {
  getRecommendationCache,
  generateConfigHash,
  generateVectorHash,
} from "./cache";
import type { VectorEmbeddings, RecommendationConfig } from "./types";
import type { RecommendationStrategy } from "./strategies";

/**
 * Generate and persist recommendations for a specific user with caching
 * 
 * This is the main public interface for the recommendation system.
 * It checks cache first, and only generates new recommendations if needed.
 * 
 * @param userId - The user's MongoDB ObjectId
 * @param userVectors - The user's TF-IDF and BERT vectors
 * @param config - Optional configuration overrides
 * @param strategy - Optional custom retrieval strategy (uses default if not provided)
 * @param useCache - Whether to use caching (default: true)
 * @returns True if recommendations were successfully generated/retrieved and saved
 */
export async function generateAndSaveRecommendations(
  userId: string,
  userVectors: VectorEmbeddings,
  config?: Partial<RecommendationConfig>,
  strategy?: RecommendationStrategy,
  useCache: boolean = true
): Promise<boolean> {
  try {
    const cache = getRecommendationCache();
    const configHash = generateConfigHash(config || {});
    const vectorHash = generateVectorHash(userVectors);

    // Check cache if enabled
    if (useCache) {
      const cached = await cache.get(userId, configHash, vectorHash);
      if (cached) {
        console.log(`[recommendation-service] Using cached recommendations for user ${userId}`);
        
        // Update user document with cached recommendations
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) {
          console.error("[recommendation-service] Database connection not available");
          return false;
        }

        const userOid = new mongoose.Types.ObjectId(userId);
        await db.collection("users").updateOne(
          { _id: userOid },
          {
            $set: {
              "recommendedInternships.updatedAt": cached.generatedAt,
              "recommendedInternships.recommendedList": cached.recommendedInternshipIds.map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
              "recommendedInternships.recommendedScores": cached.recommendedInternshipIds.map(
                (id, idx) => ({
                  id: new mongoose.Types.ObjectId(id),
                  score: Math.round(cached.scores[idx] * 1000) / 1000,
                })
              ),
            },
          }
        );

        return true;
      }
    }

    // Cache miss or disabled - generate new recommendations
    console.log(`[recommendation-service] Generating fresh recommendations for user ${userId}`);
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

    // Cache the results if enabled
    if (useCache) {
      await cache.set(
        userId,
        result.recommendations.map((r) => r.id.toString()),
        result.recommendations.map((r) => r.score),
        configHash,
        vectorHash
      );
    }

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

/**
 * Invalidate cached recommendations for a user
 * Call this when user's resume or profile changes
 */
export async function invalidateUserCache(userId: string): Promise<boolean> {
  try {
    const cache = getRecommendationCache();
    await cache.invalidate(userId);
    console.log(`[recommendation-service] Invalidated cache for user ${userId}`);
    return true;
  } catch (err) {
    console.error("[recommendation-service] Error invalidating cache:", err);
    return false;
  }
}

// Re-export types and strategies for convenience
export type { VectorEmbeddings, RecommendationConfig, ScoredRecommendation } from "./types";
export type { RecommendationStrategy, StrategyContext } from "./strategies";
export { StrategyType, StrategyFactory, getDefaultStrategy } from "./strategies";
export { getRecommendationCache } from "./cache";
