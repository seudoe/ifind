/**
 * Internship Retrieval Layer
 * 
 * Handles fetching internship candidates from the database.
 * This layer abstracts the data source and can be replaced with
 * different retrieval strategies (e.g., HNSW) without changing
 * the recommendation engine interface.
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import type { InternshipCandidate } from "./types";

/**
 * Fetch all active internships with vectors for recommendation scoring.
 * 
 * This is the current brute-force approach that loads all candidates.
 * In the future, this can be replaced with HNSW-based approximate
 * nearest neighbor search without changing the caller code.
 * 
 * @returns Array of internship candidates with their vector embeddings
 */
export async function fetchInternshipCandidates(): Promise<InternshipCandidate[]> {
  await connectDB();
  const db = mongoose.connection.db;
  
  if (!db) {
    throw new Error("Database connection not available");
  }

  const internships = await db
    .collection("internships")
    .find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
      tfidf_vector: { $exists: true },
      bert_vector: { $exists: true },
    })
    .project({ _id: 1, tfidf_vector: 1, bert_vector: 1 })
    .toArray();

  return internships as unknown as InternshipCandidate[];
}
