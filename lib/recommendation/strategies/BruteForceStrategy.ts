/**
 * Brute Force Recommendation Strategy
 * 
 * Retrieves all active internships from the database and returns them
 * for scoring. This is the simplest strategy but doesn't scale well
 * with large datasets.
 * 
 * Advantages:
 * - Simple and straightforward
 * - Always returns exact results
 * - No preprocessing required
 * 
 * Disadvantages:
 * - Loads all candidates into memory
 * - O(n) complexity where n = total internships
 * - Not suitable for large datasets (>10k internships)
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import type { InternshipCandidate } from "../types";
import type { RecommendationStrategy, StrategyContext, StrategyType } from "./types";

export class BruteForceStrategy implements RecommendationStrategy {
  readonly name = "brute-force" as const;

  /**
   * Retrieve all active internships with vectors
   * 
   * This strategy loads ALL active internships from the database,
   * regardless of the user's vectors. The scoring/filtering happens
   * later in the recommendation pipeline.
   */
  async retrieveCandidates(context: StrategyContext): Promise<InternshipCandidate[]> {
    await connectDB();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("[BruteForceStrategy] Database connection not available");
    }

    // Fetch all active internships with vectors
    const internships = await db
      .collection("internships")
      .find({
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
        tfidf_vector: { $exists: true },
        bert_vector: { $exists: true },
      })
      .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
      .toArray();

    console.log(`[BruteForceStrategy] Retrieved ${internships.length} candidates`);

    return internships as unknown as InternshipCandidate[];
  }

  /**
   * No initialization required for brute-force strategy
   */
  async initialize(): Promise<void> {
    console.log("[BruteForceStrategy] Strategy initialized (no-op)");
  }

  /**
   * No cleanup required for brute-force strategy
   */
  async dispose(): Promise<void> {
    console.log("[BruteForceStrategy] Strategy disposed (no-op)");
  }
}
