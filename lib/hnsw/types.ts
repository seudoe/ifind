/**
 * HNSW Index Types
 * 
 * Type definitions for HNSW vector index operations.
 */

import type mongoose from "mongoose";

/**
 * A vector with its associated internship ID
 */
export interface IndexedVector {
  /** MongoDB ObjectId of the internship */
  id: string;
  /** 768-dimensional BERT vector */
  vector: number[];
}

/**
 * Search result from HNSW index
 */
export interface SearchResult {
  /** Internship ID */
  id: string;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
}

/**
 * Statistics about the HNSW index
 */
export interface IndexStats {
  /** Number of vectors in the index */
  vectorCount: number;
  /** Index dimensions */
  dimensions: number;
  /** Whether index is initialized */
  isInitialized: boolean;
  /** Memory usage estimate in bytes */
  memoryUsage?: number;
}

/**
 * HNSW index persistence data structure
 */
export interface IndexPersistenceData {
  /** Serialized index data */
  indexData: string;
  /** ID to internal index mapping */
  idMapping: Record<string, number>;
  /** Reverse mapping: internal index to ID */
  reverseMapping: Record<number, string>;
  /** Metadata about the index */
  metadata: {
    vectorCount: number;
    dimensions: number;
    createdAt: Date;
    updatedAt: Date;
  };
}
