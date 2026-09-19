import { connectDB } from "./db";
import mongoose from "mongoose";
import { generateAndSaveRecommendations, invalidateUserCache } from "./recommendation";

const HF_BASE = process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space";
const BOOST_WEIGHT = 0.15;

export interface ResumeVectorResult {
  tfidf: number[];
  bert: number[];
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
 * 
 * Now uses the dedicated recommendation service for cleaner separation of concerns.
 */
export async function vectorizeAndRecommendUser(
  userId: string,
  parsedData: unknown
): Promise<boolean> {
  try {
    // Step 0: Invalidate cache since user's resume is changing
    await invalidateUserCache(userId);

    // Step 1: Encode resume and save vectors
    const vectors = await encodeAndSaveUserResume(userId, parsedData);
    if (!vectors) {
      await connectDB();
      const db = mongoose.connection.db;
      if (db) {
        await db.collection("users").updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { $set: { vectorizationStatus: "failed" } }
        );
      }
      return false;
    }

    // Step 2: Generate and save recommendations using the recommendation service
    const recommendationsGenerated = await generateAndSaveRecommendations(
      userId,
      {
        tfidf: vectors.tfidf,
        bert: vectors.bert,
      }
    );

    // Step 3: Update vectorization status
    await connectDB();
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("users").updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { vectorizationStatus: recommendationsGenerated ? "completed" : "failed" } }
      );
    }

    if (recommendationsGenerated) {
      console.log(`[vectorizer] User ${userId} vectorization and recommendation generation completed successfully.`);
    } else {
      console.warn(`[vectorizer] User ${userId} vectors saved but recommendation generation failed.`);
    }

    return recommendationsGenerated;
  } catch (err) {
    console.error("[vectorizer] Error in vectorizeAndRecommendUser:", err);
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (db) {
        await db.collection("users").updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { $set: { vectorizationStatus: "failed" } }
        );
      }
    } catch (e) {
      // Ignore inner error
    }
    return false;
  }
}
