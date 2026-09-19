/**
 * Internship Vectorization Service
 * 
 * Handles vectorization of internship postings into TF-IDF and BERT embeddings.
 * Integrates with HNSW index for efficient similarity search.
 */

import { connectDB } from "./db";
import mongoose from "mongoose";
import { getIndexManager } from "./hnsw";

const HF_BASE = process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space";

export interface InternshipVectorResult {
  tfidf: number[];
  bert: number[];
}

/**
 * Encode internship data into TF-IDF and BERT vectors
 */
export async function encodeInternship(internshipData: {
  name: string;
  company: string;
  summary: string;
  skills: string[];
  responsibilities?: string[] | null;
  tags?: string[] | null;
  field?: string[] | null;
}): Promise<InternshipVectorResult | null> {
  try {
    const res = await fetch(`${HF_BASE}/encode-internship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internship: internshipData }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[internship-vectorizer] HF encode-internship failed ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    if (!data.tfidf || !data.bert) {
      console.error("[internship-vectorizer] HF returned incomplete vector payload:", data);
      return null;
    }

    return {
      tfidf: data.tfidf,
      bert: data.bert,
    };
  } catch (err) {
    console.error("[internship-vectorizer] Error encoding internship:", err);
    return null;
  }
}

/**
 * Save internship vectors to database
 */
export async function saveInternshipVectors(
  internshipId: string,
  vectors: InternshipVectorResult
): Promise<boolean> {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) return false;

    const internshipOid = new mongoose.Types.ObjectId(internshipId);
    await db.collection("internships").updateOne(
      { _id: internshipOid },
      {
        $set: {
          tfidf_vector: vectors.tfidf,
          bert_vector: vectors.bert,
        },
      }
    );

    console.log(`[internship-vectorizer] Saved vectors for internship ${internshipId}`);
    return true;
  } catch (err) {
    console.error("[internship-vectorizer] Error saving internship vectors:", err);
    return false;
  }
}

/**
 * Insert internship vector into HNSW index
 */
export async function insertIntoHNSWIndex(
  internshipId: string,
  bertVector: number[]
): Promise<boolean> {
  try {
    const indexManager = getIndexManager();
    await indexManager.insertVector(internshipId, bertVector);
    console.log(`[internship-vectorizer] Inserted internship ${internshipId} into HNSW index`);
    return true;
  } catch (err) {
    console.error("[internship-vectorizer] Error inserting into HNSW index:", err);
    return false;
  }
}

/**
 * Remove internship from HNSW index
 */
export async function removeFromHNSWIndex(internshipId: string): Promise<boolean> {
  try {
    const indexManager = getIndexManager();
    await indexManager.deleteVector(internshipId);
    console.log(`[internship-vectorizer] Removed internship ${internshipId} from HNSW index`);
    return true;
  } catch (err) {
    console.error("[internship-vectorizer] Error removing from HNSW index:", err);
    return false;
  }
}

/**
 * Full vectorization and indexing pipeline for a new internship
 * 
 * This function:
 * 1. Encodes the internship into vectors
 * 2. Saves vectors to database
 * 3. Inserts BERT vector into HNSW index
 */
export async function vectorizeAndIndexInternship(
  internshipId: string,
  internshipData: {
    name: string;
    company: string;
    summary: string;
    skills: string[];
    responsibilities?: string[] | null;
    tags?: string[] | null;
    field?: string[] | null;
  }
): Promise<boolean> {
  try {
    console.log(`[internship-vectorizer] Starting vectorization for internship ${internshipId}`);

    // Step 1: Encode internship
    const vectors = await encodeInternship(internshipData);
    if (!vectors) {
      console.error(`[internship-vectorizer] Failed to encode internship ${internshipId}`);
      return false;
    }

    // Step 2: Save vectors to database
    const saved = await saveInternshipVectors(internshipId, vectors);
    if (!saved) {
      console.error(`[internship-vectorizer] Failed to save vectors for internship ${internshipId}`);
      return false;
    }

    // Step 3: Insert into HNSW index
    const indexed = await insertIntoHNSWIndex(internshipId, vectors.bert);
    if (!indexed) {
      console.warn(`[internship-vectorizer] Failed to insert internship ${internshipId} into HNSW index`);
      // Don't return false here - vectors are saved, index can be rebuilt later
    }

    console.log(`[internship-vectorizer] Successfully vectorized and indexed internship ${internshipId}`);
    return true;
  } catch (err) {
    console.error(`[internship-vectorizer] Error in vectorizeAndIndexInternship for ${internshipId}:`, err);
    return false;
  }
}

/**
 * Rebuild HNSW index from all active internships with vectors
 */
export async function rebuildInternshipIndex(): Promise<{
  success: boolean;
  indexed: number;
  failed: number;
}> {
  try {
    console.log("[internship-vectorizer] Starting HNSW index rebuild");

    await connectDB();
    const indexManager = getIndexManager();

    // Use the index manager's rebuild method
    await indexManager.rebuildIndex();

    const stats = indexManager.getStats();
    console.log("[internship-vectorizer] HNSW index rebuild complete");
    
    return {
      success: true,
      indexed: stats.vectorCount,
      failed: 0,
    };
  } catch (err) {
    console.error("[internship-vectorizer] Error rebuilding index:", err);
    return {
      success: false,
      indexed: 0,
      failed: 0,
    };
  }
}

/**
 * Handle internship deactivation or deletion
 * Removes the internship from HNSW index
 */
export async function deactivateInternship(internshipId: string): Promise<boolean> {
  try {
    console.log(`[internship-vectorizer] Deactivating internship ${internshipId}`);
    
    // Remove from HNSW index
    await removeFromHNSWIndex(internshipId);
    
    // Update isActive flag in database
    await connectDB();
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("internships").updateOne(
        { _id: new mongoose.Types.ObjectId(internshipId) },
        { $set: { isActive: false } }
      );
    }
    
    console.log(`[internship-vectorizer] Successfully deactivated internship ${internshipId}`);
    return true;
  } catch (err) {
    console.error(`[internship-vectorizer] Error deactivating internship ${internshipId}:`, err);
    return false;
  }
}

/**
 * Batch vectorize multiple internships (useful for bulk imports)
 */
export async function batchVectorizeInternships(
  internships: Array<{
    _id: string;
    name: string;
    company: string;
    summary: string;
    skills: string[];
    responsibilities?: string[] | null;
    tags?: string[] | null;
    field?: string[] | null;
  }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const internship of internships) {
    const result = await vectorizeAndIndexInternship(
      internship._id,
      internship
    );
    
    if (result) {
      success++;
    } else {
      failed++;
    }

    // Small delay to avoid overwhelming the vectorization service
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[internship-vectorizer] Batch complete: ${success} success, ${failed} failed`);
  return { success, failed };
}
