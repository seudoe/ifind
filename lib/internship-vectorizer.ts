/**
 * Triggers for the vectoriser service (tf-idfs+berts/vectoriser, a Hugging Face Space).
 *
 * The vectoriser does all the work: encode, insert into the HNSW graph, then run every student through the graph
 * so their recommendations improve (recommender.py). This module only calls it.
 *
 * Who calls it, per path:
 *   scraped, auto-approved     internScraper  (script.py)                       -> /vectorize-hnsw
 *   scraped, moderator         ifind (here)   publishApprovedInternships        -> /vectorize-hnsw {ids}
 *   employer, auto-approved    internScraper  (pipeline.py, after /process)     -> /vectorize-platform
 *   employer, moderator        ifind (here)   vectorizePlatformInternships      -> /vectorize-platform {ids}
 *   admin refresh              ifind (here)   refreshRecommendations            -> both, then /recommend-all
 *   resume / profile change    ifind          lib/vectorizer.ts                 -> /encode-resume {recommend}
 */

import { connectDB } from "./db";
import mongoose from "mongoose";

const HF_BASE = (process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space").replace(/\/$/, "");

async function post<T>(path: string, body: unknown, timeoutMs = 120_000): Promise<T | null> {
  try {
    const res = await fetch(`${HF_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs), // the first call after a cold start loads the models
    });
    if (!res.ok) {
      console.error(`[internship-vectorizer] ${path} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[internship-vectorizer] ${path} unreachable:`, err);
    return null;
  }
}

interface PipelineStats {
  processed: number;
  errors: number;
  skipped: number;
  indexed_ids?: string[];
  vectorized_ids?: string[];
}

/**
 * Scraped internships a moderator approved (all approved staged ones when `ids` is omitted): vectorize,
 * insert into the graph, move to `internships`; the vectoriser then re-runs every student through the graph.
 * Returns the ids that were published. Failures leave the doc in staging, still approved, so the next run retries.
 */
export async function publishApprovedInternships(ids?: string[], recommend = true): Promise<string[]> {
  const r = await post<{ stats: PipelineStats }>("/vectorize-hnsw", { ...(ids ? { ids } : {}), recommend });
  return r?.stats.indexed_ids ?? [];
}

/**
 * Employer-posted internships a moderator approved: the vectoriser writes the vectors onto the document in
 * 'internships.this-platform', adds it to the graph and re-runs every student through it.
 * (Pipeline auto-approvals are sent by internScraper, not from here.) Returns the ids that were vectorized.
 */
export async function vectorizePlatformInternships(ids: string[], recommend = true): Promise<string[]> {
  if (!ids.length) return [];
  const r = await post<{ stats: PipelineStats }>("/vectorize-platform", { ids, recommend });
  return r?.stats.vectorized_ids ?? [];
}

/**
 * Admin refresh. Sends anything approved but not yet vectorized to the vectoriser (scraped staging docs and employer
 * posts without vectors), then asks it to run every student (or just `userIds`) through the whole graph.
 * The recommendation pass runs in the vectoriser in the background; this returns once it is queued.
 */
export async function refreshRecommendations(userIds?: string[]) {
  const published = await publishApprovedInternships(undefined, false);

  await connectDB();
  const pending = await mongoose.connection.db!
    .collection("internships.this-platform")
    .find({ status: { $ne: "draft" }, isActive: { $ne: false }, "moderation.status": { $in: ["auto_approved", "manually_approved"] }, vectorizedAt: null }, { projection: { _id: 1 } })
    .limit(50)
    .toArray();
  const platform = await vectorizePlatformInternships(pending.map((d) => String(d._id)), false);

  const queued = await post<{ status: string }>("/recommend-all", { ...(userIds?.length ? { user_ids: userIds } : {}), background: true });
  return { scrapedPublished: published.length, platformVectorized: platform.length, recommendationsQueued: queued?.status === "queued" };
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
