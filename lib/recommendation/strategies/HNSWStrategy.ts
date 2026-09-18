/**
 * HNSW (Hierarchical Navigable Small World) Recommendation Strategy
 * 
 * Uses HNSW graph-based approximate nearest neighbor search to efficiently
 * retrieve the most relevant candidates without scoring all internships.
 * 
 * Advantages:
 * - Efficient approximate k-NN search
 * - Sublinear query time complexity
 * - Scales to millions of internships
 * - Memory-efficient navigation
 * 
 * Disadvantages:
 * - Requires pre-built HNSW index
 * - Returns approximate (not exact) results
 * - Index must be rebuilt when internships change
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getIndexManager } from "@/lib/hnsw";
import type { InternshipCandidate } from "../types";
import type { RecommendationStrategy, StrategyContext } from "./types";

export class HNSWStrategy implements RecommendationStrategy {
  readonly name = "hnsw" as const;

  private isInitialized = false;

  /**
   * Retrieve candidates using HNSW approximate nearest neighbor search
   * 
   * Uses the user's BERT vector to perform approximate k-NN search,
   * then fetches full candidate data from MongoDB.
   */
  async retrieveCandidates(context: StrategyContext): Promise<InternshipCandidate[]> {
    if (!this.isInitialized) {
      throw new Error(
        "[HNSWStrategy] Strategy not initialized. Call initialize() first."
      );
    }

    try {
      const indexManager = getIndexManager();

      if (!indexManager.isReady()) {
        throw new Error("[HNSWStrategy] Index not ready");
      }

      // Get k value (default to limit * 2 or 40 if no limit specified)
      const k = context.limit ? context.limit * 2 : 40;

      // Perform HNSW search using BERT vector
      const searchResults = await indexManager.searchNearestNeighbors(
        context.userVectors.bert,
        k
      );

      console.log(
        `[HNSWStrategy] HNSW search returned ${searchResults.length} candidates`
      );

      // Fetch full candidate data from MongoDB
      await connectDB();
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error("Database connection not available");
      }

      const internshipIds = searchResults.map((result) => 
        new mongoose.Types.ObjectId(result.id)
      );

      const internships = await db
        .collection("internships")
        .find({ _id: { $in: internshipIds } })
        .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
        .toArray();

      console.log(
        `[HNSWStrategy] Retrieved ${internships.length} full candidate records`
      );

      return internships as unknown as InternshipCandidate[];
    } catch (error) {
      console.error("[HNSWStrategy] Failed to retrieve candidates:", error);
      throw error;
    }
  }

  /**
   * Initialize HNSW strategy by loading the index from database
   * 
   * Loads the HNSW index from MongoDB and prepares it for search operations.
   */
  async initialize(): Promise<void> {
    console.log("[HNSWStrategy] Initializing HNSW index...");

    try {
      const indexManager = getIndexManager();

      // Load index from database (or initialize if not exists)
      await indexManager.loadFromDatabase();

      const stats = indexManager.getStats();
      console.log(
        `[HNSWStrategy] Index initialized with ${stats.vectorCount} vectors, ` +
        `${stats.dimensions} dimensions`
      );

      this.isInitialized = true;
    } catch (error) {
      console.error("[HNSWStrategy] Failed to initialize:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Clean up HNSW resources
   */
  async dispose(): Promise<void> {
    console.log("[HNSWStrategy] Disposing HNSW strategy...");
    this.isInitialized = false;
  }
}
