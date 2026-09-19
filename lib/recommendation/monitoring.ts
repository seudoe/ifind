/**
 * Recommendation System Monitoring
 * 
 * Provides monitoring and logging utilities for the recommendation pipeline.
 */

import { getIndexManager } from "@/lib/hnsw";
import { getRecommendationCache } from "./cache";

/**
 * System metrics
 */
export interface SystemMetrics {
  hnsw: {
    indexSize: number;
    dimensions: number;
    metric: string;
    ready: boolean;
  };
  cache: {
    totalEntries: number;
    expiredEntries: number;
  };
  timestamp: Date;
}

/**
 * Get current system metrics
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const { getHNSWConfig } = await import("@/lib/hnsw/config");
  const indexManager = getIndexManager();
  const cache = getRecommendationCache();

  const [indexStats, cacheStats, hnswConfig] = await Promise.all([
    Promise.resolve(indexManager.getStats()),
    cache.getStats(),
    Promise.resolve(getHNSWConfig()),
  ]);

  return {
    hnsw: {
      indexSize: indexStats.vectorCount,
      dimensions: indexStats.dimensions,
      metric: hnswConfig.metric,
      ready: indexManager.isReady(),
    },
    cache: {
      totalEntries: cacheStats.totalEntries,
      expiredEntries: cacheStats.expiredEntries,
    },
    timestamp: new Date(),
  };
}

/**
 * Log system metrics to console
 */
export async function logSystemMetrics(): Promise<void> {
  const metrics = await getSystemMetrics();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  RECOMMENDATION SYSTEM METRICS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  HNSW Index:`);
  console.log(`    - Status: ${metrics.hnsw.ready ? "✓ Ready" : "✗ Not Ready"}`);
  console.log(`    - Vectors: ${metrics.hnsw.indexSize}`);
  console.log(`    - Dimensions: ${metrics.hnsw.dimensions}`);
  console.log(`    - Metric: ${metrics.hnsw.metric}`);
  console.log(``);
  console.log(`  Cache:`);
  console.log(`    - Total Entries: ${metrics.cache.totalEntries}`);
  console.log(`    - Expired: ${metrics.cache.expiredEntries}`);
  console.log(``);
  console.log(`  Timestamp: ${metrics.timestamp.toISOString()}`);
  console.log("═══════════════════════════════════════════════════════");
}

/**
 * Performance tracker for measuring operation latency
 */
export class PerformanceTracker {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Mark a checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  /**
   * Get elapsed time since start
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get time for a specific checkpoint
   */
  getCheckpoint(name: string): number | undefined {
    return this.checkpoints.get(name);
  }

  /**
   * Get all checkpoints
   */
  getAllCheckpoints(): Record<string, number> {
    return Object.fromEntries(this.checkpoints);
  }

  /**
   * Log performance summary
   */
  log(operation: string): void {
    const total = this.elapsed();
    console.log(`[performance] ${operation} completed in ${total}ms`);
    
    if (this.checkpoints.size > 0) {
      console.log(`[performance] Breakdown:`);
      for (const [name, time] of this.checkpoints) {
        console.log(`  - ${name}: ${time}ms`);
      }
    }
  }
}
