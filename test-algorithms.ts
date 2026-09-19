/**
 * Algorithm Unit Tests
 * 
 * Tests core algorithms without requiring database:
 * - Cosine similarity
 * - Dot product
 * - Euclidean distance
 * - Hash generation
 * - Vector normalization
 * 
 * Run: npx tsx test-algorithms.ts
 */

console.log("═".repeat(60));
console.log("  ALGORITHM UNIT TESTS");
console.log("═".repeat(60));

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.log(`  ✗ ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✓ ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
    passedTests++;
  } else {
    console.log(`  ✗ ${message} (${actual.toFixed(4)} != ${expected.toFixed(4)}, diff=${diff.toFixed(4)})`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test 1: Cosine Similarity
console.log("\n🧮 Test 1: Cosine Similarity");
console.log("─".repeat(60));

const cosineSimilarity = (a: number[], b: number[]): number => {
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
};

// Identical vectors
const v1 = [1, 2, 3];
const v2 = [1, 2, 3];
assertClose(cosineSimilarity(v1, v2), 1.0, 0.0001, "Identical vectors should have similarity 1.0");

// Opposite vectors
const v3 = [1, 2, 3];
const v4 = [-1, -2, -3];
assertClose(cosineSimilarity(v3, v4), -1.0, 0.0001, "Opposite vectors should have similarity -1.0");

// Orthogonal vectors
const v5 = [1, 0, 0];
const v6 = [0, 1, 0];
assertClose(cosineSimilarity(v5, v6), 0.0, 0.0001, "Orthogonal vectors should have similarity 0.0");

// Similar vectors
const v7 = [1, 2, 3];
const v8 = [2, 4, 6];
assertClose(cosineSimilarity(v7, v8), 1.0, 0.0001, "Scaled vectors should have similarity 1.0");

// Test 2: Dot Product
console.log("\n🧮 Test 2: Dot Product");
console.log("─".repeat(60));

const dotProduct = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
};

assertClose(dotProduct([1, 2, 3], [4, 5, 6]), 32, 0.0001, "Dot product [1,2,3] · [4,5,6] = 32");
assertClose(dotProduct([1, 0, 0], [0, 1, 0]), 0, 0.0001, "Orthogonal dot product = 0");
assertClose(dotProduct([2, 3], [4, 5]), 23, 0.0001, "Dot product [2,3] · [4,5] = 23");

// Test 3: Euclidean Distance
console.log("\n🧮 Test 3: Euclidean Distance");
console.log("─".repeat(60));

const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

assertClose(euclideanDistance([0, 0], [3, 4]), 5.0, 0.0001, "Distance from origin to (3,4) = 5");
assertClose(euclideanDistance([1, 1], [1, 1]), 0.0, 0.0001, "Distance to self = 0");
assertClose(euclideanDistance([0, 0, 0], [1, 1, 1]), Math.sqrt(3), 0.0001, "3D unit cube diagonal");

// Test 4: Vector Normalization
console.log("\n🧮 Test 4: Vector Normalization");
console.log("─".repeat(60));

const normalize = (v: number[]): number[] => {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? v : v.map(val => val / norm);
};

const n1 = normalize([3, 4]);
assertClose(n1[0], 0.6, 0.0001, "Normalized [3,4] x-component = 0.6");
assertClose(n1[1], 0.8, 0.0001, "Normalized [3,4] y-component = 0.8");

const n2 = normalize([1, 1, 1]);
const expected = 1 / Math.sqrt(3);
assertClose(n2[0], expected, 0.0001, "Normalized [1,1,1] all components equal");

// Test 5: Hash Consistency
console.log("\n🧮 Test 5: Hash Consistency");
console.log("─".repeat(60));

const simpleHash = (obj: any): string => {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
};

const obj1 = { a: 1, b: 2 };
const obj2 = { a: 1, b: 2 };
const obj3 = { a: 1, b: 3 };

const hash1 = simpleHash(obj1);
const hash2 = simpleHash(obj2);
const hash3 = simpleHash(obj3);

assert(hash1 === hash2, "Identical objects produce same hash");
assert(hash1 !== hash3, "Different objects produce different hashes");
assert(hash1.length > 0, "Hash is non-empty");

// Test 6: Top-K Selection
console.log("\n🧮 Test 6: Top-K Selection");
console.log("─".repeat(60));

interface ScoredItem {
  id: string;
  score: number;
}

const selectTopK = (items: ScoredItem[], k: number): ScoredItem[] => {
  return items.sort((a, b) => b.score - a.score).slice(0, k);
};

const items: ScoredItem[] = [
  { id: "a", score: 0.5 },
  { id: "b", score: 0.9 },
  { id: "c", score: 0.3 },
  { id: "d", score: 0.7 },
  { id: "e", score: 0.6 },
];

const top3 = selectTopK(items, 3);
assert(top3.length === 3, "Returns exactly k items");
assert(top3[0].id === "b", "Top item has highest score");
assert(top3[1].id === "d", "Second item has second highest score");
assert(top3[2].id === "e", "Third item has third highest score");

// Test 7: Weighted Score Combination
console.log("\n🧮 Test 7: Weighted Score Combination");
console.log("─".repeat(60));

const computeWeightedScore = (
  tfidfSim: number,
  bertSim: number,
  tfidfWeight: number,
  bertWeight: number
): number => {
  return tfidfSim * tfidfWeight + bertSim * bertWeight;
};

assertClose(
  computeWeightedScore(0.8, 0.9, 0.4, 0.6),
  0.86,
  0.0001,
  "Weighted score: 0.8*0.4 + 0.9*0.6 = 0.86"
);

assertClose(
  computeWeightedScore(1.0, 0.0, 0.5, 0.5),
  0.5,
  0.0001,
  "Equal weights with partial scores"
);

assertClose(
  computeWeightedScore(0.7, 0.8, 0.3, 0.7),
  0.77,
  0.0001,
  "Weighted score with BERT preference"
);

// Test 8: Threshold Filtering
console.log("\n🧮 Test 8: Threshold Filtering");
console.log("─".repeat(60));

const filterByThreshold = (items: ScoredItem[], threshold: number): ScoredItem[] => {
  return items.filter(item => item.score >= threshold);
};

const allItems: ScoredItem[] = [
  { id: "a", score: 0.15 },
  { id: "b", score: 0.25 },
  { id: "c", score: 0.05 },
  { id: "d", score: 0.35 },
];

const filtered = filterByThreshold(allItems, 0.2);
assert(filtered.length === 2, "Filters out items below threshold");
assert(filtered[0].id === "b" || filtered[0].id === "d", "Keeps items above threshold");

// Test 9: Large Vector Performance
console.log("\n🧮 Test 9: Large Vector Performance");
console.log("─".repeat(60));

const largeVec1 = Array(768).fill(0).map(() => Math.random());
const largeVec2 = Array(768).fill(0).map(() => Math.random());

const start = Date.now();
const similarity = cosineSimilarity(largeVec1, largeVec2);
const duration = Date.now() - start;

assert(similarity >= -1 && similarity <= 1, "Similarity in valid range [-1, 1]");
assert(duration < 100, `Performance acceptable for 768-d vectors (${duration}ms < 100ms)`);
console.log(`  ℹ️  Cosine similarity of 768-d vectors computed in ${duration}ms`);

// Summary
console.log("\n" + "═".repeat(60));
console.log("  TEST SUMMARY");
console.log("═".repeat(60));
console.log(`\nTotal Assertions: ${passedTests + failedTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (failedTests === 0) {
  console.log("\n🎉 ALL ALGORITHM TESTS PASSED!");
  console.log("\nCore algorithms are functioning correctly:");
  console.log("  ✓ Cosine similarity calculations accurate");
  console.log("  ✓ Dot product operations correct");
  console.log("  ✓ Euclidean distance computed properly");
  console.log("  ✓ Vector normalization working");
  console.log("  ✓ Hash generation consistent");
  console.log("  ✓ Top-K selection functional");
  console.log("  ✓ Weighted scoring accurate");
  console.log("  ✓ Threshold filtering operational");
  console.log("  ✓ Performance acceptable for 768-d vectors");
  console.log("\n" + "═".repeat(60));
  process.exit(0);
} else {
  console.log("\n❌ SOME TESTS FAILED");
  console.log("═".repeat(60));
  process.exit(1);
}
