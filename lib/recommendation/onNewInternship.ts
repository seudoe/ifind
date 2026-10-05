/**
 * When a new internship is published, merge it into the recommendations of
 * every student whose resume vector matches it.
 *
 * One dot-product per student for the NEW internship only (O(students)); the
 * heavy student×internship comparison is never repeated. Per-student top-N
 * retrieval still goes through the HNSW graph (see HNSWStrategy).
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { computeSimilarityScore } from "./scoring";
import { getRecommendationCache } from "./cache";

const TOP_N = 20;
const THRESHOLD = 0.1;
const TFIDF_WEIGHT = 0.4;
const BERT_WEIGHT = 0.6;

export async function addInternshipToRecommendations(internshipId: string): Promise<number> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not available");

  const oid = new mongoose.Types.ObjectId(internshipId);
  const internship = await db
    .collection("internships")
    .findOne({ _id: oid }, { projection: { tfidf_vector: 1, bert_vector: 1 } });
  if (!internship?.bert_vector) return 0;

  const cache = getRecommendationCache();
  const users = db.collection("users").find(
    { "resume.bert_vector": { $exists: true } },
    { projection: { "resume.bert_vector": 1, "resume.tfidf_vector": 1, "recommendedInternships.recommendedScores": 1 } },
  );

  let updated = 0;
  for await (const user of users) {
    const score = computeSimilarityScore(
      user.resume?.tfidf_vector,
      user.resume?.bert_vector,
      internship.tfidf_vector,
      internship.bert_vector,
      TFIDF_WEIGHT,
      BERT_WEIGHT,
    );
    if (score < THRESHOLD) continue;

    const current: { id: mongoose.Types.ObjectId; score: number }[] =
      user.recommendedInternships?.recommendedScores ?? [];
    const merged = [
      ...current.filter((r) => String(r.id) !== internshipId),
      { id: oid, score: Math.round(score * 1000) / 1000 },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    if (!merged.some((r) => String(r.id) === internshipId)) continue; // didn't make the cut

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          "recommendedInternships.updatedAt": new Date(),
          "recommendedInternships.recommendedList": merged.map((r) => r.id),
          "recommendedInternships.recommendedScores": merged,
        },
      },
    );
    // Cached lists no longer match what is stored; force a recompute on next refresh.
    await cache.invalidate(String(user._id));
    updated++;
  }

  console.log(`[onNewInternship] ${internshipId} added to ${updated} student recommendation list(s)`);
  return updated;
}
