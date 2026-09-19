/**
 * Recommendation Scoring Utilities
 * 
 * Core mathematical operations for computing recommendation scores.
 * This module handles vector similarity calculations.
 */

/**
 * Compute dot product between two vectors
 * Returns 0 if vectors are null, undefined, or have different lengths
 */
export function dotProduct(
  a: number[] | null | undefined,
  b: number[] | null | undefined
): number {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Compute weighted similarity score between user and internship vectors
 * 
 * @param userTfidf - User's TF-IDF vector
 * @param userBert - User's BERT vector
 * @param internshipTfidf - Internship's TF-IDF vector
 * @param internshipBert - Internship's BERT vector
 * @param tfidfWeight - Weight for TF-IDF similarity (default: 0.4)
 * @param bertWeight - Weight for BERT similarity (default: 0.6)
 * @returns Combined weighted similarity score
 */
export function computeSimilarityScore(
  userTfidf: number[] | null | undefined,
  userBert: number[] | null | undefined,
  internshipTfidf: number[] | null | undefined,
  internshipBert: number[] | null | undefined,
  tfidfWeight: number = 0.4,
  bertWeight: number = 0.6
): number {
  const tfidfSim = dotProduct(userTfidf, internshipTfidf);
  const bertSim = dotProduct(userBert, internshipBert);
  return tfidfSim * tfidfWeight + bertSim * bertWeight;
}
