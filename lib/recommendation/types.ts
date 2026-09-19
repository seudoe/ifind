/**
 * Recommendation Engine Types
 * 
 * Core type definitions for the recommendation system.
 * These types provide a clean contract between the recommendation
 * engine and the rest of the application.
 */

import type mongoose from "mongoose";

/**
 * Vector embeddings for semantic matching
 */
export interface VectorEmbeddings {
  tfidf: number[];
  bert: number[];
}

/**
 * A candidate internship for recommendation with its vectors
 */
export interface InternshipCandidate {
  _id: mongoose.Types.ObjectId;
  tfidf_vector: number[];
  bert_vector: number[];
}

/**
 * A scored recommendation result
 */
export interface ScoredRecommendation {
  id: mongoose.Types.ObjectId;
  score: number;
}

/**
 * Configuration for recommendation generation
 */
export interface RecommendationConfig {
  /** Weight for TF-IDF similarity (0-1) */
  tfidfWeight: number;
  /** Weight for BERT similarity (0-1) */
  bertWeight: number;
  /** Maximum number of recommendations to return */
  topN: number;
  /** Minimum score threshold (0-1) */
  threshold: number;
}

/**
 * Parameters for generating recommendations
 */
export interface GenerateRecommendationsParams {
  /** User's resume vectors */
  userVectors: VectorEmbeddings;
  /** Configuration (optional, uses defaults if not provided) */
  config?: Partial<RecommendationConfig>;
}

/**
 * Result of recommendation generation
 */
export interface RecommendationResult {
  recommendations: ScoredRecommendation[];
  config: RecommendationConfig;
  candidatesEvaluated: number;
}
