/**
 * Recommendation Cache Service
 * 
 * Provides caching layer for user recommendations to avoid expensive
 * recomputation on every request. Cache entries are invalidated when:
 * - User's resume/profile changes
 * - Recommendation configuration changes
 * - Cache entry expires (TTL)
 */

import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

/**
 * Cache entry structure stored in MongoDB
 */
export interface CacheEntry {
  userId: string;
  recommendedInternshipIds: string[];
  scores: number[];
  generatedAt: Date;
  expiresAt: Date;
  configHash: string; // Hash of recommendation config for invalidation
  vectorHash: string; // Hash of user vectors for invalidation
}

/**
 * Configuration for cache behavior
 */
export interface CacheConfig {
  ttlMinutes?: number; // Time-to-live in minutes (default: 60)
  collectionName?: string; // MongoDB collection name (default: "recommendation_cache")
}

const DEFAULT_CONFIG: Required<CacheConfig> = {
  ttlMinutes: 60,
  collectionName: "recommendation_cache",
};

/**
 * Generate a simple hash for cache invalidation
 */
function simpleHash(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

/**
 * Recommendation Cache Manager
 */
export class RecommendationCache {
  private config: Required<CacheConfig>;

  constructor(config?: CacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached recommendations for a user
   * 
   * @returns Cached entry if valid, null otherwise
   */
  async get(
    userId: string,
    configHash: string,
    vectorHash: string
  ): Promise<CacheEntry | null> {
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (!db) return null;

      const now = new Date();
      const entry = await db.collection(this.config.collectionName).findOne({
        userId,
        configHash,
        vectorHash,
        expiresAt: { $gt: now },
      } as any);

      if (entry) {
        console.log(`[recommendation-cache] Cache HIT for user ${userId}`);
        return {
          userId: entry.userId,
          recommendedInternshipIds: entry.recommendedInternshipIds,
          scores: entry.scores,
          generatedAt: entry.generatedAt,
          expiresAt: entry.expiresAt,
          configHash: entry.configHash,
          vectorHash: entry.vectorHash,
        };
      }

      console.log(`[recommendation-cache] Cache MISS for user ${userId}`);
      return null;
    } catch (error) {
      console.error("[recommendation-cache] Error getting cache:", error);
      return null;
    }
  }

  /**
   * Store recommendations in cache
   */
  async set(
    userId: string,
    recommendedInternshipIds: string[],
    scores: number[],
    configHash: string,
    vectorHash: string
  ): Promise<boolean> {
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (!db) return false;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.ttlMinutes * 60 * 1000);

      const entry: CacheEntry = {
        userId,
        recommendedInternshipIds,
        scores,
        generatedAt: now,
        expiresAt,
        configHash,
        vectorHash,
      };

      // Upsert cache entry
      await db.collection(this.config.collectionName).updateOne(
        { userId } as any,
        { $set: entry },
        { upsert: true }
      );

      console.log(`[recommendation-cache] Cached recommendations for user ${userId} (expires: ${expiresAt.toISOString()})`);
      return true;
    } catch (error) {
      console.error("[recommendation-cache] Error setting cache:", error);
      return false;
    }
  }

  /**
   * Invalidate cache for a specific user
   */
  async invalidate(userId: string): Promise<boolean> {
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (!db) return false;

      const result = await db.collection(this.config.collectionName).deleteOne(
        { userId } as any
      );

      if (result.deletedCount > 0) {
        console.log(`[recommendation-cache] Invalidated cache for user ${userId}`);
      }
      return true;
    } catch (error) {
      console.error("[recommendation-cache] Error invalidating cache:", error);
      return false;
    }
  }

  /**
   * Invalidate all expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (!db) return 0;

      const now = new Date();
      const result = await db.collection(this.config.collectionName).deleteMany({
        expiresAt: { $lt: now },
      });

      const count = result.deletedCount || 0;
      if (count > 0) {
        console.log(`[recommendation-cache] Cleaned up ${count} expired cache entries`);
      }
      return count;
    } catch (error) {
      console.error("[recommendation-cache] Error cleaning up expired cache:", error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
  }> {
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (!db) return { totalEntries: 0, expiredEntries: 0 };

      const now = new Date();
      const [totalEntries, expiredEntries] = await Promise.all([
        db.collection(this.config.collectionName).countDocuments({}),
        db.collection(this.config.collectionName).countDocuments({
          expiresAt: { $lt: now },
        }),
      ]);

      return { totalEntries, expiredEntries };
    } catch (error) {
      console.error("[recommendation-cache] Error getting stats:", error);
      return { totalEntries: 0, expiredEntries: 0 };
    }
  }
}

/**
 * Singleton cache instance
 */
let cacheInstance: RecommendationCache | null = null;

/**
 * Get the global recommendation cache instance
 */
export function getRecommendationCache(config?: CacheConfig): RecommendationCache {
  if (!cacheInstance) {
    cacheInstance = new RecommendationCache(config);
  }
  return cacheInstance;
}

/**
 * Helper to generate config hash
 */
export function generateConfigHash(config: any): string {
  return simpleHash({
    tfidfWeight: config.tfidfWeight,
    bertWeight: config.bertWeight,
    topN: config.topN,
    threshold: config.threshold,
  });
}

/**
 * Helper to generate vector hash
 */
export function generateVectorHash(vectors: { tfidf: number[]; bert: number[] }): string {
  // For efficiency, hash only first and last few elements + length
  const sample = {
    tfidf_len: vectors.tfidf.length,
    tfidf_head: vectors.tfidf.slice(0, 5),
    tfidf_tail: vectors.tfidf.slice(-5),
    bert_len: vectors.bert.length,
    bert_head: vectors.bert.slice(0, 5),
    bert_tail: vectors.bert.slice(-5),
  };
  return simpleHash(sample);
}
