/**
 * HNSW Index Module
 * 
 * Public API for HNSW vector index operations.
 * Provides a singleton instance for global index access.
 */

import { HNSWIndexManager } from "./HNSWIndexManager";
import type { HNSWConfig } from "./config";

// Singleton instance
let globalIndexManager: HNSWIndexManager | null = null;

/**
 * Get or create the global HNSW index manager instance
 * 
 * @param config - Optional configuration override
 * @returns Singleton instance of HNSWIndexManager
 */
export function getIndexManager(config?: Partial<HNSWConfig>): HNSWIndexManager {
  if (!globalIndexManager) {
    globalIndexManager = new HNSWIndexManager(config);
  }
  return globalIndexManager;
}

/**
 * Reset the global index manager
 * Useful for testing or forcing reinitialization
 */
export function resetIndexManager(): void {
  if (globalIndexManager) {
    globalIndexManager.dispose();
    globalIndexManager = null;
  }
}

// Re-export types and classes
export { HNSWIndexManager } from "./HNSWIndexManager";
export type { HNSWConfig } from "./config";
export { getHNSWConfig, DEFAULT_HNSW_CONFIG } from "./config";
export type {
  IndexedVector,
  SearchResult,
  IndexStats,
  IndexPersistenceData,
} from "./types";
