/**
 * Internship publishing service
 *
 * Moderator approval hand-off:
 *   staging ('internships.mod-unvectorised')
 *     → HF vectorizer: encode, insert into HNSW graph ('internships.graph'),
 *       move to 'internships', delete from staging
 *     → add the new internship to matching students' recommendations
 *
 * All encoding and graph writes live in the HF service (vectorisationResume);
 * this module only triggers it and then updates recommendations.
 */

import { connectDB } from "./db";
import mongoose from "mongoose";
import { addInternshipToRecommendations } from "./recommendation/onNewInternship";

const HF_BASE = (process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space").replace(/\/$/, "");

interface PipelineStats {
  processed: number;
  errors: number;
  skipped: number;
  indexed_ids: string[];
}

async function callVectorizer(ids?: string[]): Promise<PipelineStats | null> {
  try {
    const res = await fetch(`${HF_BASE}/vectorize-hnsw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (!res.ok) {
      console.error(`[internship-vectorizer] /vectorize-hnsw failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return (await res.json()).stats as PipelineStats;
  } catch (err) {
    console.error("[internship-vectorizer] /vectorize-hnsw unreachable:", err);
    return null;
  }
}

/**
 * Publish approved staged internships (all approved when `ids` is omitted):
 * vectorize + graph-insert + move to `internships`, then recommend to students.
 * Returns the ids that were published. Failures leave the doc in staging, still
 * approved, so the next run retries it.
 */
export async function publishApprovedInternships(ids?: string[]): Promise<string[]> {
  const stats = await callVectorizer(ids);
  if (!stats) return [];

  for (const id of stats.indexed_ids) {
    try {
      await addInternshipToRecommendations(id);
    } catch (err) {
      console.error(`[internship-vectorizer] Recommendation update failed for ${id}:`, err);
    }
  }
  return stats.indexed_ids;
}

/**
 * Vectorize approved employer-posted internships (source "ifind"). The vectorizer writes the vectors onto the
 * document in 'internships.this-platform' in place: no staging, no move, and no graph insert (see
 * vectorizer_hnsw_pipeline.run_platform_vectorizer_pipeline). Best effort: returns the ids that were vectorized.
 */
export async function vectorizePlatformInternships(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  try {
    const res = await fetch(`${HF_BASE}/vectorize-platform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(120_000), // first call after a cold start loads the models
    });
    if (!res.ok) {
      console.error(`[internship-vectorizer] /vectorize-platform failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    return (await res.json()).stats?.vectorized_ids ?? [];
  } catch (err) {
    console.error("[internship-vectorizer] /vectorize-platform unreachable:", err);
    return [];
  }
}

/**
 * Rebuild the HNSW graph from every active internship's stored vector.
 */
export async function rebuildInternshipIndex(): Promise<{
  success: boolean;
  indexed: number;
  failed: number;
}> {
  try {
    const res = await fetch(`${HF_BASE}/rebuild-graph`, { method: "POST" });
    if (!res.ok) return { success: false, indexed: 0, failed: 0 };
    const data = await res.json();
    return { success: true, indexed: data.indexed ?? 0, failed: 0 };
  } catch (err) {
    console.error("[internship-vectorizer] Error rebuilding index:", err);
    return { success: false, indexed: 0, failed: 0 };
  }
}

/**
 * Deactivate a live internship. Search results are filtered by isActive, so it
 * stops being recommended immediately; the next graph rebuild drops the node.
 */
export async function deactivateInternship(internshipId: string): Promise<boolean> {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) return false;
    await db.collection("internships").updateOne(
      { _id: new mongoose.Types.ObjectId(internshipId) },
      { $set: { isActive: false } }
    );
    return true;
  } catch (err) {
    console.error(`[internship-vectorizer] Error deactivating internship ${internshipId}:`, err);
    return false;
  }
}
