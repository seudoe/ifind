/**
 * HNSW Index Manager
 * 
 * Manages an optimized vector index for efficient approximate nearest neighbor
 * search of internship vectors.
 * 
 * This implementation uses an in-memory flat index with optimized search.
 * For production at scale, this can be replaced with a proper HNSW library
 * like hnswlib-node (requires native compilation) or faiss.
 */

import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { getHNSWConfig, type HNSWConfig } from "./config";
import type { IndexedVector, SearchResult, IndexStats, IndexPersistenceData } from "./types";

/**
 * Simple vector operations
 */
class VectorOps {
  /**
   * Compute cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Compute dot product between two vectors
   */
  static dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Compute Euclidean distance between two vectors
   */
  static euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

/**
 * HNSW Index Manager
 * 
 * Provides a high-level interface for managing the vector index:
 * - Initialize/load index from database
 * - Insert/delete internship vectors
 * - Search for nearest neighbors
 * - Rebuild entire index
 * - Persist to database
 */
export class HNSWIndexManager {
  private vectors: Map<string, number[]> = new Map();
  private config: HNSWConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<HNSWConfig>) {
    this.config = { ...getHNSWConfig(), ...config };
  }

  /**
   * Initialize the HNSW index
   * 
   * Creates a new empty index with the configured parameters.
   * Call loadFromDatabase() to load existing index data.
   */
  async initialize(): Promise<void> {
    try {
      console.log("[HNSWIndexManager] Initializing index...");
      this.vectors.clear();
      this.isInitialized = true;
      console.log(
        `[HNSWIndexManager] Index initialized with dimensions=${this.config.dimensions}, ` +
        `metric=${this.config.metric}`
      );
    } catch (error) {
      console.error("[HNSWIndexManager] Failed to initialize index:", error);
      this.isInitialized = false;
      throw new Error("Failed to initialize index");
    }
  }

  /**
   * Load index from MongoDB database
   * 
   * Attempts to load existing index data from the 'internships.graph' collection.
   * If no data exists, initializes an empty index.
   */
  async loadFromDatabase(): Promise<void> {
    try {
      console.log("[HNSWIndexManager] Loading index from database...");
      await connectDB();
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error("Database connection not available");
      }

      // Try to load existing index data
      const indexDoc = await db.collection("internships.graph").findOne({ _id: "hnsw_index" } as any);

      if (indexDoc && indexDoc.data && indexDoc.data.vectors) {
        console.log("[HNSWIndexManager] Found existing index data, restoring...");
        await this.restoreFromData(indexDoc.data);
        console.log(`[HNSWIndexManager] Index loaded successfully with ${this.getStats().vectorCount} vectors`);
      } else {
        console.log("[HNSWIndexManager] No existing index found, initializing empty index");
        await this.initialize();
      }
    } catch (error) {
      console.error("[HNSWIndexManager] Failed to load index from database:", error);
      console.log("[HNSWIndexManager] Falling back to empty index initialization");
      await this.initialize();
    }
  }

  /**
   * Restore index from serialized data
   */
  private async restoreFromData(data: any): Promise<void> {
    await this.initialize();

    // Restore vectors
    if (data.vectors) {
      this.vectors = new Map(Object.entries(data.vectors));
    }

    console.log("[HNSWIndexManager] Index structure restored");
  }

  /**
   * Insert a new internship vector into the index
   * 
   * @param id - MongoDB ObjectId of the internship (as string)
   * @param vector - 768-dimensional BERT vector
   */
  async insertVector(id: string, vector: number[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Index not initialized. Call initialize() first.");
    }

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.length}`
      );
    }

    try {
      // Store vector
      this.vectors.set(id, vector);
      console.log(`[HNSWIndexManager] Inserted vector for internship ${id}`);
    } catch (error) {
      console.error(`[HNSWIndexManager] Failed to insert vector ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an internship vector from the index
   * 
   * @param id - MongoDB ObjectId of the internship (as string)
   */
  async deleteVector(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Index not initialized. Call initialize() first.");
    }

    try {
      if (!this.vectors.has(id)) {
        console.log(`[HNSWIndexManager] Vector ${id} not found in index`);
        return;
      }

      this.vectors.delete(id);
      console.log(`[HNSWIndexManager] Deleted vector for internship ${id}`);
    } catch (error) {
      console.error(`[HNSWIndexManager] Failed to delete vector ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for k nearest neighbors
   * 
   * @param queryVector - 768-dimensional query vector (user's BERT vector)
   * @param k - Number of nearest neighbors to return
   * @returns Array of search results with internship IDs and similarity scores
   */
  async searchNearestNeighbors(queryVector: number[], k: number = 20): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error("Index not initialized. Call initialize() first.");
    }

    if (queryVector.length !== this.config.dimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.config.dimensions}, got ${queryVector.length}`
      );
    }

    try {
      const results: SearchResult[] = [];

      // Compute similarity for all vectors
      for (const [id, vector] of this.vectors.entries()) {
        let score: number;

        switch (this.config.metric) {
          case "cosine":
            score = VectorOps.cosineSimilarity(queryVector, vector);
            break;
          case "dotProduct":
            score = VectorOps.dotProduct(queryVector, vector);
            break;
          case "euclidean":
            // Convert distance to similarity (inverse)
            const distance = VectorOps.euclideanDistance(queryVector, vector);
            score = 1 / (1 + distance);
            break;
          default:
            score = VectorOps.cosineSimilarity(queryVector, vector);
        }

        results.push({ id, score });
      }

      // Sort by score descending and take top k
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, k);
    } catch (error) {
      console.error("[HNSWIndexManager] Search failed:", error);
      throw error;
    }
  }

  /**
   * Rebuild the entire index from database
   * 
   * Loads all active internship vectors from MongoDB and rebuilds the index.
   * This is useful when:
   * - Index becomes corrupted
   * - HNSW parameters change
   * - Large batch of internships added
   */
  async rebuildIndex(): Promise<void> {
    console.log("[HNSWIndexManager] Rebuilding index from database...");

    try {
      await connectDB();
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error("Database connection not available");
      }

      // Initialize fresh index
      await this.initialize();

      // Load all active internships with BERT vectors
      const internships = await db
        .collection("internships")
        .find({
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
          bert_vector: { $exists: true },
        })
        .project({ _id: 1, bert_vector: 1 })
        .toArray();

      console.log(`[HNSWIndexManager] Found ${internships.length} internships to index`);

      // Insert all vectors
      let successCount = 0;
      let errorCount = 0;

      for (const internship of internships) {
        try {
          const id = internship._id.toString();
          const vector = internship.bert_vector;

          if (Array.isArray(vector) && vector.length === this.config.dimensions) {
            await this.insertVector(id, vector);
            successCount++;
          } else {
            console.warn(
              `[HNSWIndexManager] Invalid vector for internship ${id}: ` +
              `expected array of length ${this.config.dimensions}`
            );
            errorCount++;
          }
        } catch (error) {
          console.error(`[HNSWIndexManager] Failed to insert vector:`, error);
          errorCount++;
        }
      }

      console.log(
        `[HNSWIndexManager] Index rebuild complete. ` +
        `Success: ${successCount}, Errors: ${errorCount}`
      );

      // Persist the rebuilt index
      await this.persistToDatabase();
    } catch (error) {
      console.error("[HNSWIndexManager] Index rebuild failed:", error);
      throw error;
    }
  }

  /**
   * Persist the index to MongoDB database
   * 
   * Saves the current index state to the 'internships.graph' collection.
   */
  async persistToDatabase(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Index not initialized. Cannot persist.");
    }

    try {
      console.log("[HNSWIndexManager] Persisting index to database...");
      await connectDB();
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error("Database connection not available");
      }

      // Convert Map to plain object for storage
      const vectorsObj = Object.fromEntries(this.vectors);

      // Prepare persistence data
      const persistenceData = {
        vectors: vectorsObj,
        metadata: {
          vectorCount: this.vectors.size,
          dimensions: this.config.dimensions,
          metric: this.config.metric,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Upsert to database
      await db.collection("internships.graph").updateOne(
        { _id: "hnsw_index" } as any,
        {
          $set: {
            data: persistenceData,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`[HNSWIndexManager] Index persisted successfully with ${this.vectors.size} vectors`);
    } catch (error) {
      console.error("[HNSWIndexManager] Failed to persist index:", error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return {
      vectorCount: this.vectors.size,
      dimensions: this.config.dimensions,
      isInitialized: this.isInitialized,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    // Each vector takes dimensions * 8 bytes (float64 in JavaScript)
    return this.vectors.size * this.config.dimensions * 8;
  }

  /**
   * Check if index is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Dispose of the index and free resources
   */
  async dispose(): Promise<void> {
    console.log("[HNSWIndexManager] Disposing index...");
    this.vectors.clear();
    this.isInitialized = false;
  }
}
