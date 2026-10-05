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
import type { InternshipCandidate } from "../types";
import type { RecommendationStrategy, StrategyContext } from "./types";
import { BruteForceStrategy } from "./BruteForceStrategy";

const HF_BASE = (process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space").replace(/\/$/, "");

/** k-NN over the persisted graph ('internships.graph'), served by the vectorizer service. */
async function searchGraph(vector: number[], k: number): Promise<string[]> {
  const res = await fetch(`${HF_BASE}/search-internships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vector, k }),
  });
  if (!res.ok) throw new Error(`graph search failed ${res.status}`);
  const data = await res.json();
  return (data.results as { id: string }[]).map((r) => r.id);
}

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
      const k = context.limit ? context.limit * 2 : 40;

      const searchStart = Date.now();
      const ids = await searchGraph(context.userVectors.bert, k);
      console.log(`[HNSWStrategy] Graph search returned ${ids.length} candidates in ${Date.now() - searchStart}ms`);

      await connectDB();
      const db = mongoose.connection.db;
      if (!db) throw new Error("Database connection not available");

      // isActive filter: deactivated listings can linger in the graph until the next rebuild.
      const internships = await db
        .collection("internships")
        .find({
          _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
        })
        .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
        .toArray();

      return internships as unknown as InternshipCandidate[];
    } catch (error) {
      // Graph unavailable: degrade to a full scan rather than returning no recommendations.
      console.error("[HNSWStrategy] Graph search failed, falling back to brute force:", error);
      return new BruteForceStrategy().retrieveCandidates(context);
    }
  }

  /**
   * Initialize HNSW strategy by loading the index from database
   * 
   * Loads the HNSW index from MongoDB and prepares it for search operations.
   */
  async initialize(): Promise<void> {
    // The graph lives in the vectorizer service; nothing to load locally.
    this.isInitialized = true;
  }

  /**
   * Clean up HNSW resources
   */
  async dispose(): Promise<void> {
    console.log("[HNSWStrategy] Disposing HNSW strategy...");
    this.isInitialized = false;
  }
}
