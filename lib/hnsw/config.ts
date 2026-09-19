/**
 * HNSW Index Configuration
 * 
 * Centralized configuration for HNSW vector index parameters.
 * These values affect index quality, search performance, and memory usage.
 */

/**
 * HNSW Index Configuration
 */
export interface HNSWConfig {
  /** Dimensionality of vectors (768 for BERT embeddings) */
  dimensions: number;

  /** Distance metric for similarity calculation */
  metric: "cosine" | "euclidean" | "dotProduct";

  /** Maximum number of connections per node (M parameter) */
  maxConnections: number;

  /** Size of the dynamic candidate list during construction (efConstruction) */
  efConstruction: number;

  /** Size of the dynamic candidate list during search (efSearch) */
  efSearch: number;
}

/**
 * Default HNSW configuration optimized for BERT 768-d vectors
 * 
 * These parameters are based on common HNSW best practices:
 * - M=16: Good balance between recall and speed for ~1M vectors
 * - efConstruction=200: High quality index construction
 * - efSearch=50: Fast search with good recall
 * - cosine metric: Standard for normalized embeddings
 */
export const DEFAULT_HNSW_CONFIG: HNSWConfig = {
  dimensions: 768, // BERT all-mpnet-base-v2 embedding size
  metric: "cosine",
  maxConnections: 16,
  efConstruction: 200,
  efSearch: 50,
};

/**
 * Get HNSW configuration from environment or use defaults
 */
export function getHNSWConfig(): HNSWConfig {
  return {
    dimensions: parseInt(process.env.HNSW_DIMENSIONS || String(DEFAULT_HNSW_CONFIG.dimensions)),
    metric: (process.env.HNSW_METRIC as HNSWConfig["metric"]) || DEFAULT_HNSW_CONFIG.metric,
    maxConnections: parseInt(process.env.HNSW_MAX_CONNECTIONS || String(DEFAULT_HNSW_CONFIG.maxConnections)),
    efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || String(DEFAULT_HNSW_CONFIG.efConstruction)),
    efSearch: parseInt(process.env.HNSW_EF_SEARCH || String(DEFAULT_HNSW_CONFIG.efSearch)),
  };
}
