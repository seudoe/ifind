/**
 * Recommendation Strategy Types
 * 
 * Defines the contract for pluggable recommendation retrieval strategies.
 * Different strategies can implement different algorithms for fetching
 * candidate internships (e.g., brute-force, HNSW, hybrid approaches).
 */

import type { InternshipCandidate, VectorEmbeddings } from "../types";

/**
 * Strategy context for retrieval operations
 * Contains user vectors and any additional context needed for retrieval
 */
export interface StrategyContext {
  /** User's vector embeddings */
  userVectors: VectorEmbeddings;
  /** Optional limit on number of candidates to retrieve */
  limit?: number;
  /** Optional additional parameters for strategy-specific behavior */
  params?: Record<string, unknown>;
}

/**
 * Abstract interface for recommendation retrieval strategies
 * 
 * All retrieval strategies must implement this interface to be
 * compatible with the recommendation engine.
 */
export interface RecommendationStrategy {
  /**
   * Unique identifier for this strategy
   */
  readonly name: string;

  /**
   * Retrieve candidate internships for recommendation
   * 
   * @param context - Strategy context including user vectors
   * @returns Array of internship candidates with their vectors
   */
  retrieveCandidates(context: StrategyContext): Promise<InternshipCandidate[]>;

  /**
   * Optional: Strategy initialization/warmup
   * Can be used to load indexes, warm caches, etc.
   */
  initialize?(): Promise<void>;

  /**
   * Optional: Strategy cleanup
   * Can be used to close connections, clear resources, etc.
   */
  dispose?(): Promise<void>;
}

/**
 * Supported strategy types
 */
export enum StrategyType {
  BRUTE_FORCE = "brute-force",
  HNSW = "hnsw",
}
