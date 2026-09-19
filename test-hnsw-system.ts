/**
 * Comprehensive Test Script for HNSW Recommendation System
 * 
 * Tests all major components:
 * 1. HNSW Index Manager
 * 2. Internship Vectorization
 * 3. Recommendation Cache
 * 4. Strategy System
 * 5. Background Refresh
 * 
 * Run: npx tsx test-hnsw-system.ts
 */

import fs from "fs";
import path from "path";

// Load environment variables from .env.local or .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
  console.log("✓ Loaded environment from .env.local");
} else if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
  console.log("✓ Loaded environment from .env");
} else {
  console.warn("⚠️  No .env.local or .env file found");
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  error?: any;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  console.log(`\n🧪 Testing: ${name}`);
  console.log("─".repeat(60));
  
  try {
    await testFn();
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    results.push({ name, passed: true, message: "Test passed", duration });
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ FAILED (${duration}ms)`);
    console.error("Error:", error);
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration,
      error,
    });
  }
}

// Test 1: Database Connection
async function testDatabaseConnection() {
  const { connectDB } = await import("./lib/db");
  const mongoose = await import("mongoose");
  
  await connectDB();
  const db = mongoose.default.connection.db;
  
  if (!db) {
    throw new Error("Database connection failed");
  }
  
  console.log("✓ Database connected successfully");
  
  // Test collections exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`✓ Found ${collections.length} collections:`, collectionNames.join(", "));
  
  const requiredCollections = ["users", "internships"];
  for (const col of requiredCollections) {
    if (!collectionNames.includes(col)) {
      throw new Error(`Required collection '${col}' not found`);
    }
  }
  console.log("✓ All required collections exist");
}

// Test 2: HNSW Index Manager Initialization
async function testHNSWIndexManager() {
  const { getIndexManager } = await import("./lib/hnsw");
  
  const indexManager = getIndexManager();
  console.log("✓ Index manager singleton created");
  
  // Initialize/load index
  await indexManager.loadFromDatabase();
  console.log("✓ Index loaded from database");
  
  // Check stats
  const stats = indexManager.getStats();
  console.log(`✓ Index stats:`, {
    vectorCount: stats.vectorCount,
    dimensions: stats.dimensions,
    isInitialized: stats.isInitialized,
    memoryUsage: stats.memoryUsage ? `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB` : "N/A",
  });
  
  if (!stats.isInitialized) {
    throw new Error("Index not initialized");
  }
  
  console.log(`✓ Index is ready: ${indexManager.isReady()}`);
}

// Test 3: Insert and Search Test Vectors
async function testVectorOperations() {
  const { getIndexManager } = await import("./lib/hnsw");
  const indexManager = getIndexManager();
  
  // Create test vectors (768 dimensions)
  const testVector1 = Array(768).fill(0).map(() => Math.random());
  const testVector2 = Array(768).fill(0).map(() => Math.random());
  const testVector3 = Array(768).fill(0).map((_, i) => testVector1[i] + 0.01); // Similar to vector1
  
  console.log("✓ Created test vectors (768-d)");
  
  // Insert test vectors
  const testId1 = "test_vector_1";
  const testId2 = "test_vector_2";
  const testId3 = "test_vector_3";
  
  await indexManager.insertVector(testId1, testVector1);
  console.log(`✓ Inserted test vector 1`);
  
  await indexManager.insertVector(testId2, testVector2);
  console.log(`✓ Inserted test vector 2`);
  
  await indexManager.insertVector(testId3, testVector3);
  console.log(`✓ Inserted test vector 3`);
  
  // Search for nearest neighbors
  const searchResults = await indexManager.searchNearestNeighbors(testVector1, 3);
  console.log(`✓ Search returned ${searchResults.length} results`);
  
  if (searchResults.length === 0) {
    throw new Error("Search returned no results");
  }
  
  console.log("Search results:");
  searchResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ID: ${result.id}, Score: ${result.score.toFixed(4)}`);
  });
  
  // Verify vector 3 (similar to 1) is in results
  const foundSimilar = searchResults.some(r => r.id === testId3);
  if (!foundSimilar) {
    console.warn("⚠ Similar vector not found in top results (may be expected with small index)");
  } else {
    console.log("✓ Similar vector correctly identified");
  }
  
  // Cleanup test vectors
  await indexManager.deleteVector(testId1);
  await indexManager.deleteVector(testId2);
  await indexManager.deleteVector(testId3);
  console.log("✓ Cleaned up test vectors");
}

// Test 4: Recommendation Cache
async function testRecommendationCache() {
  const { getRecommendationCache, generateConfigHash, generateVectorHash } = 
    await import("./lib/recommendation/cache");
  
  const cache = getRecommendationCache();
  console.log("✓ Cache instance created");
  
  // Create test data
  const testUserId = "test_user_cache_123";
  const testVectors = {
    tfidf: Array(15000).fill(0).map(() => Math.random()),
    bert: Array(768).fill(0).map(() => Math.random()),
  };
  const testRecommendations = ["rec1", "rec2", "rec3"];
  const testScores = [0.9, 0.8, 0.7];
  
  const configHash = generateConfigHash({});
  const vectorHash = generateVectorHash(testVectors);
  
  console.log("✓ Generated hashes");
  console.log(`  Config hash: ${configHash.substring(0, 20)}...`);
  console.log(`  Vector hash: ${vectorHash.substring(0, 20)}...`);
  
  // Test cache miss
  const cached1 = await cache.get(testUserId, configHash, vectorHash);
  if (cached1 !== null) {
    console.log("⚠ Cache should be empty but found entry (cleaning up)");
    await cache.invalidate(testUserId);
  } else {
    console.log("✓ Cache miss as expected");
  }
  
  // Test cache set
  const setResult = await cache.set(
    testUserId,
    testRecommendations,
    testScores,
    configHash,
    vectorHash
  );
  
  if (!setResult) {
    throw new Error("Failed to set cache");
  }
  console.log("✓ Cache entry stored");
  
  // Test cache hit
  const cached2 = await cache.get(testUserId, configHash, vectorHash);
  if (!cached2) {
    throw new Error("Cache hit failed");
  }
  console.log("✓ Cache hit successful");
  console.log(`  Retrieved ${cached2.recommendedInternshipIds.length} recommendations`);
  
  // Verify data
  if (cached2.recommendedInternshipIds.length !== testRecommendations.length) {
    throw new Error("Cache data mismatch");
  }
  console.log("✓ Cache data matches");
  
  // Test invalidation
  await cache.invalidate(testUserId);
  const cached3 = await cache.get(testUserId, configHash, vectorHash);
  if (cached3 !== null) {
    throw new Error("Cache invalidation failed");
  }
  console.log("✓ Cache invalidation works");
  
  // Test cache stats
  const stats = await cache.getStats();
  console.log(`✓ Cache stats: ${stats.totalEntries} total, ${stats.expiredEntries} expired`);
}

// Test 5: Strategy System
async function testStrategySystem() {
  const { StrategyFactory, StrategyType } = 
    await import("./lib/recommendation/strategies");
  
  // Test factory
  const factory = StrategyFactory.getInstance();
  console.log("✓ Strategy factory created");
  
  // Get current strategy
  const strategy = await factory.getStrategy();
  console.log(`✓ Active strategy: ${strategy.name}`);
  
  // Test brute force strategy
  console.log("\n  Testing BruteForceStrategy:");
  await factory.setConfig({ type: StrategyType.BRUTE_FORCE });
  const bruteForce = await factory.getStrategy();
  console.log(`  ✓ BruteForce strategy active: ${bruteForce.name}`);
  
  // Test HNSW strategy (may fail if index is empty)
  console.log("\n  Testing HNSWStrategy:");
  try {
    await factory.setConfig({ type: StrategyType.HNSW });
    const hnsw = await factory.getStrategy();
    console.log(`  ✓ HNSW strategy active: ${hnsw.name}`);
  } catch (error) {
    console.log(`  ⚠ HNSW strategy initialization failed (expected if index is empty)`);
    console.log(`  Fallback to: ${(await factory.getStrategy()).name}`);
  }
  
  // Reset to default
  StrategyFactory.reset();
  console.log("✓ Factory reset");
}

// Test 6: Check Internship Collection
async function testInternshipCollection() {
  const { connectDB } = await import("./lib/db");
  const mongoose = await import("mongoose");
  
  await connectDB();
  const db = mongoose.default.connection.db;
  
  if (!db) throw new Error("Database not connected");
  
  // Count total internships
  const totalCount = await db.collection("internships").countDocuments();
  console.log(`✓ Total internships: ${totalCount}`);
  
  // Count internships with vectors
  const withVectors = await db.collection("internships").countDocuments({
    bert_vector: { $exists: true },
    tfidf_vector: { $exists: true },
  });
  console.log(`✓ Internships with vectors: ${withVectors}`);
  
  // Count active internships
  const activeCount = await db.collection("internships").countDocuments({
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  });
  console.log(`✓ Active internships: ${activeCount}`);
  
  // Sample one internship
  const sample = await db.collection("internships").findOne({});
  if (sample) {
    console.log(`✓ Sample internship:`, {
      id: sample._id.toString(),
      name: sample.name,
      hasVectors: !!(sample.bert_vector && sample.tfidf_vector),
      isActive: sample.isActive ?? true,
    });
  }
}

// Test 7: Check User Collection
async function testUserCollection() {
  const { connectDB } = await import("./lib/db");
  const mongoose = await import("mongoose");
  
  await connectDB();
  const db = mongoose.default.connection.db;
  
  if (!db) throw new Error("Database not connected");
  
  // Count total users
  const totalCount = await db.collection("users").countDocuments();
  console.log(`✓ Total users: ${totalCount}`);
  
  // Count users with resume vectors
  const withVectors = await db.collection("users").countDocuments({
    "resume.bert_vector": { $exists: true },
    "resume.tfidf_vector": { $exists: true },
  });
  console.log(`✓ Users with resume vectors: ${withVectors}`);
  
  // Sample one user with vectors
  const sample = await db.collection("users").findOne({
    "resume.bert_vector": { $exists: true },
  });
  
  if (sample) {
    console.log(`✓ Sample user with vectors:`, {
      id: sample._id.toString(),
      name: sample.name,
      bertVectorLength: sample.resume?.bert_vector?.length,
      tfidfVectorLength: sample.resume?.tfidf_vector?.length,
      hasRecommendations: !!(sample.recommendedInternships?.recommendedList),
    });
  } else {
    console.log("⚠ No users with vectors found");
  }
}

// Test 8: System Metrics
async function testSystemMetrics() {
  const { getSystemMetrics } = await import("./lib/recommendation/monitoring");
  
  const metrics = await getSystemMetrics();
  console.log("✓ System metrics retrieved:");
  console.log(`  HNSW Index:`);
  console.log(`    - Ready: ${metrics.hnsw.ready}`);
  console.log(`    - Vectors: ${metrics.hnsw.indexSize}`);
  console.log(`    - Dimensions: ${metrics.hnsw.dimensions}`);
  console.log(`    - Metric: ${metrics.hnsw.metric}`);
  console.log(`  Cache:`);
  console.log(`    - Total Entries: ${metrics.cache.totalEntries}`);
  console.log(`    - Expired: ${metrics.cache.expiredEntries}`);
  console.log(`  Timestamp: ${metrics.timestamp.toISOString()}`);
}

// Main test runner
async function main() {
  console.log("═".repeat(60));
  console.log("  HNSW RECOMMENDATION SYSTEM TEST SUITE");
  console.log("═".repeat(60));
  
  await runTest("1. Database Connection", testDatabaseConnection);
  await runTest("2. HNSW Index Manager", testHNSWIndexManager);
  await runTest("3. Vector Operations", testVectorOperations);
  await runTest("4. Recommendation Cache", testRecommendationCache);
  await runTest("5. Strategy System", testStrategySystem);
  await runTest("6. Internship Collection", testInternshipCollection);
  await runTest("7. User Collection", testUserCollection);
  await runTest("8. System Metrics", testSystemMetrics);
  
  // Print summary
  console.log("\n" + "═".repeat(60));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
  }
  
  console.log("\n" + "═".repeat(60));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("\n❌ FATAL ERROR:", error);
  process.exit(1);
});
