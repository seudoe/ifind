import { connectDB } from "./db";
import mongoose from "mongoose";

const HF_BASE = process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space";
const BOOST_WEIGHT = 0.15;

export interface ResumeVectorResult {
  tfidf: number[];
  bert: number[];
}

function dot(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Encodes parsed resume data into TF-IDF (15,000-d) and BERT (768-d) vectors
 * by sending a POST request to the Hugging Face Vectorizer API service (/encode-resume).
 */
export async function encodeResume(parsedData: unknown): Promise<ResumeVectorResult | null> {
  try {
    const res = await fetch(`${HF_BASE}/encode-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: parsedData, boost_weight: BOOST_WEIGHT }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[vectorizer] HF encode-resume failed ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    if (!data.tfidf || !data.bert) {
      console.error("[vectorizer] HF returned incomplete vector payload:", data);
      return null;
    }

    return {
      tfidf: data.tfidf,
      bert: data.bert,
    };
  } catch (err) {
    console.error("[vectorizer] Error encoding resume:", err);
    return null;
  }
}

/**
 * Saves generated TF-IDF and BERT vectors into the user document in MongoDB.
 * Sets both user.resume.tfidf_vector / bert_vector and user.resume.parsedData fields.
 */
export async function saveUserResumeVectors(
  userId: string,
  vectors: ResumeVectorResult
): Promise<boolean> {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) return false;

    const userOid = new mongoose.Types.ObjectId(userId);
    await db.collection("users").updateOne(
      { _id: userOid },
      {
        $set: {
          "resume.tfidf_vector": vectors.tfidf,
          "resume.bert_vector": vectors.bert,
          "resume.parsedData.tfidf__vector": vectors.tfidf,
          "resume.parsedData.bert_vector": vectors.bert,
          "resume.parsedData.tfidf_vector": vectors.tfidf,
        },
      }
    );
    return true;
  } catch (err) {
    console.error("[vectorizer] Error saving user resume vectors:", err);
    return false;
  }
}

/**
 * Helper to encode and store resume vectors in a single call.
 */
export async function encodeAndSaveUserResume(
  userId: string,
  parsedData: unknown
): Promise<ResumeVectorResult | null> {
  const vectors = await encodeResume(parsedData);
  if (vectors) {
    await saveUserResumeVectors(userId, vectors);
  }
  return vectors;
}

/**
 * Full end-to-end trigger: Encodes user resume/profile data, saves vectors to DB,
 * and re-calculates recommended internships.
 */
export async function vectorizeAndRecommendUser(
  userId: string,
  parsedData: unknown
): Promise<boolean> {
  try {
    const vectors = await encodeAndSaveUserResume(userId, parsedData);
    if (!vectors) return false;

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) return false;

    const W_TFIDF = 0.4;
    const W_BERT = 0.6;
    const TOP_N = 20;
    const THRESHOLD = 0.1;

    // Load all active internships with vectors
    const internships = await db
      .collection("internships")
      .find({
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
        tfidf_vector: { $exists: true },
        bert_vector: { $exists: true },
      })
      .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
      .toArray();

    const scored = internships
      .map((intern) => ({
        id: intern._id,
        score: dot(vectors.tfidf, intern.tfidf_vector) * W_TFIDF + dot(vectors.bert, intern.bert_vector) * W_BERT,
      }))
      .filter((s) => s.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    const userOid = new mongoose.Types.ObjectId(userId);
    await db.collection("users").updateOne(
      { _id: userOid },
      {
        $set: {
          "recommendedInternships.updatedAt": new Date(),
          "recommendedInternships.recommendedList": scored.map((r) => r.id),
          "recommendedInternships.recommendedScores": scored.map((r) => ({ id: r.id, score: Math.round(r.score * 1000) / 1000 })),
        },
      }
    );

    console.log(`[vectorizer] User ${userId} vectors re-encoded & ${scored.length} recommendations updated.`);
    return true;
  } catch (err) {
    console.error("[vectorizer] Error in vectorizeAndRecommendUser:", err);
    return false;
  }
}
