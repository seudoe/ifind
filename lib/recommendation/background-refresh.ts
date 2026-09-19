/**
 * Background Recommendation Refresh Service
 * 
 * Handles batch refresh of recommendations for recently active users.
 * Avoids global recomputation after every internship insertion.
 */

import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { generateAndSaveRecommendations } from "./index";
import type { VectorEmbeddings } from "./types";

/**
 * Configuration for background refresh
 */
export interface RefreshConfig {
  batchSize?: number; // Number of users to process per batch (default: 50)
  activeThresholdDays?: number; // Consider users active if logged in within N days (default: 7)
  delayBetweenBatchesMs?: number; // Delay between batches to avoid overload (default: 1000)
  skipInactiveUsers?: boolean; // Skip users who haven't been active recently (default: true)
}

const DEFAULT_CONFIG: Required<RefreshConfig> = {
  batchSize: 50,
  activeThresholdDays: 7,
  delayBetweenBatchesMs: 1000,
  skipInactiveUsers: true,
};

/**
 * Result of a background refresh operation
 */
export interface RefreshResult {
  success: boolean;
  processedUsers: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  skippedUsers: number;
  durationMs: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * Background Refresh Manager
 */
export class BackgroundRefreshManager {
  private config: Required<RefreshConfig>;
  private isRunning: boolean = false;

  constructor(config?: RefreshConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a refresh is currently running
   */
  isRefreshRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Refresh recommendations for recently active users
   */
  async refreshActiveUsers(): Promise<RefreshResult> {
    if (this.isRunning) {
      throw new Error("[background-refresh] Refresh already in progress");
    }

    this.isRunning = true;
    const startTime = Date.now();
    const result: RefreshResult = {
      success: false,
      processedUsers: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      skippedUsers: 0,
      durationMs: 0,
      errors: [],
    };

    try {
      console.log("[background-refresh] Starting background refresh for active users");

      await connectDB();
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error("Database connection not available");
      }

      // Build query for active users
      const query: any = {
        "resume.bert_vector": { $exists: true },
        "resume.tfidf_vector": { $exists: true },
      };

      if (this.config.skipInactiveUsers) {
        const activeThreshold = new Date();
        activeThreshold.setDate(activeThreshold.getDate() - this.config.activeThresholdDays);
        query.lastLogin = { $gte: activeThreshold };
      }

      // Get total count
      const totalUsers = await db.collection("users").countDocuments(query);
      console.log(`[background-refresh] Found ${totalUsers} users to process`);

      // Process in batches
      let skip = 0;
      while (skip < totalUsers) {
        const batch = await db
          .collection("users")
          .find(query)
          .project({
            _id: 1,
            "resume.bert_vector": 1,
            "resume.tfidf_vector": 1,
          })
          .skip(skip)
          .limit(this.config.batchSize)
          .toArray();

        console.log(
          `[background-refresh] Processing batch ${Math.floor(skip / this.config.batchSize) + 1} ` +
          `(${batch.length} users)`
        );

        // Process each user in the batch
        for (const user of batch) {
          try {
            const userId = user._id.toString();
            const vectors: VectorEmbeddings = {
              tfidf: user.resume.tfidf_vector,
              bert: user.resume.bert_vector,
            };

            // Generate and save recommendations (will use cache if valid)
            const success = await generateAndSaveRecommendations(userId, vectors);

            if (success) {
              result.successfulRefreshes++;
            } else {
              result.failedRefreshes++;
              result.errors.push({
                userId,
                error: "Recommendation generation returned false",
              });
            }
          } catch (error) {
            result.failedRefreshes++;
            result.errors.push({
              userId: user._id.toString(),
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(
              `[background-refresh] Failed to refresh user ${user._id}:`,
              error
            );
          }

          result.processedUsers++;
        }

        skip += this.config.batchSize;

        // Delay between batches to avoid overloading the system
        if (skip < totalUsers) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.delayBetweenBatchesMs)
          );
        }
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[background-refresh] Completed: ${result.successfulRefreshes} successful, ` +
        `${result.failedRefreshes} failed, ${result.skippedUsers} skipped ` +
        `in ${result.durationMs}ms`
      );

      return result;
    } catch (error) {
      console.error("[background-refresh] Fatal error during refresh:", error);
      result.success = false;
      result.durationMs = Date.now() - startTime;
      result.errors.push({
        userId: "SYSTEM",
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Refresh recommendations for a specific list of users
   */
  async refreshSpecificUsers(userIds: string[]): Promise<RefreshResult> {
    if (this.isRunning) {
      throw new Error("[background-refresh] Refresh already in progress");
    }

    this.isRunning = true;
    const startTime = Date.now();
    const result: RefreshResult = {
      success: false,
      processedUsers: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      skippedUsers: 0,
      durationMs: 0,
      errors: [],
    };

    try {
      console.log(`[background-refresh] Refreshing ${userIds.length} specific users`);

      await connectDB();
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error("Database connection not available");
      }

      for (const userId of userIds) {
        try {
          const user = await db.collection("users").findOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
              projection: {
                "resume.bert_vector": 1,
                "resume.tfidf_vector": 1,
              },
            }
          );

          if (!user || !user.resume?.bert_vector || !user.resume?.tfidf_vector) {
            result.skippedUsers++;
            console.warn(`[background-refresh] Skipping user ${userId} (no vectors)`);
            continue;
          }

          const vectors: VectorEmbeddings = {
            tfidf: user.resume.tfidf_vector,
            bert: user.resume.bert_vector,
          };

          const success = await generateAndSaveRecommendations(userId, vectors);

          if (success) {
            result.successfulRefreshes++;
          } else {
            result.failedRefreshes++;
            result.errors.push({
              userId,
              error: "Recommendation generation returned false",
            });
          }
        } catch (error) {
          result.failedRefreshes++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`[background-refresh] Failed to refresh user ${userId}:`, error);
        }

        result.processedUsers++;
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[background-refresh] Completed: ${result.successfulRefreshes} successful, ` +
        `${result.failedRefreshes} failed, ${result.skippedUsers} skipped ` +
        `in ${result.durationMs}ms`
      );

      return result;
    } catch (error) {
      console.error("[background-refresh] Fatal error during refresh:", error);
      result.success = false;
      result.durationMs = Date.now() - startTime;
      result.errors.push({
        userId: "SYSTEM",
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    } finally {
      this.isRunning = false;
    }
  }
}

/**
 * Singleton refresh manager instance
 */
let refreshManagerInstance: BackgroundRefreshManager | null = null;

/**
 * Get the global background refresh manager
 */
export function getRefreshManager(config?: RefreshConfig): BackgroundRefreshManager {
  if (!refreshManagerInstance) {
    refreshManagerInstance = new BackgroundRefreshManager(config);
  }
  return refreshManagerInstance;
}
