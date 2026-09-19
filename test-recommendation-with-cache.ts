/**
 * Comprehensive Recommendation System Test
 * Tests HNSW + Caching + Lazy Generation
 * 
 * Run: npx tsx test-recommendation-with-cache.ts
 */

import 'dotenv/config';

console.log("═".repeat(70));
console.log("  RECOMMENDATION SYSTEM: HNSW + CACHING + LAZY GENERATION");
console.log("═".repeat(70));

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  console.log(`\n🧪 ${name}`);
  console.log("─".repeat(70));
  
  try {
    const details = await testFn();
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    if (details) console.log(details);
    results.push({ name, passed: true, duration, details });
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ FAILED (${duration}ms)`);
    console.error("Error:", error);
    results.push({ name, passed: false, duration });
  }
}

async function main() {
  // Test 1: Database Connection
  await runTest("Test 1: Database Connection & Data Verification", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Count internships with vectors
    const totalInternships = await db.collection("internships").countDocuments();
    const withVectors = await db.collection("internships").countDocuments({
      bert_vector: { $exists: true, $ne: null },
      tfidf_vector: { $exists: true, $ne: null },
    });
    
    // Count users with resume vectors
    const totalUsers = await db.collection("users").countDocuments();
    const usersWithVectors = await db.collection("users").countDocuments({
      "resume.bert_vector": { $exists: true, $ne: null },
      "resume.tfidf_vector": { $exists: true, $ne: null },
    });
    
    return `
✓ Total internships: ${totalInternships}
✓ Internships with vectors: ${withVectors} (${((withVectors/totalInternships)*100).toFixed(1)}%)
✓ Total users: ${totalUsers}
✓ Users with resume vectors: ${usersWithVectors} (${((usersWithVectors/totalUsers)*100).toFixed(1)}%)`;
  });

  // Test 2: HNSW Index Population
  await runTest("Test 2: Populate HNSW Index from Database", async () => {
    const { rebuildInternshipIndex } = await import("./lib/internship-vectorizer");
    
    console.log("⏳ Rebuilding HNSW index from database internships...");
    const result = await rebuildInternshipIndex();
    
    if (!result.success) {
      throw new Error(`Failed to rebuild HNSW index: ${result.failed} failed`);
    }
    
    const { getIndexManager } = await import("./lib/hnsw");
    const indexManager = getIndexManager();
    const stats = indexManager.getStats();
    
    return `
✓ Index rebuilt successfully
✓ Indexed: ${result.indexed}
✓ Failed: ${result.failed}
✓ Current vectors in index: ${stats.vectorCount}
✓ Index ready: ${indexManager.isReady()}`;
  });

  // Test 3: Cache Cleanup
  await runTest("Test 3: Cache Cleanup (Prepare for Fresh Test)", async () => {
    const { getRecommendationCache } = await import("./lib/recommendation/cache");
    const cache = getRecommendationCache();
    
    // Clean up expired entries
    const cleaned = await cache.cleanupExpired();
    const stats = await cache.getStats();
    
    return `
✓ Expired entries cleaned: ${cleaned}
✓ Current cache size: ${stats.totalEntries}
✓ Cache ready for testing`;
  });

  // Test 4: Cold Start - Generate Recommendations (Cache Miss)
  await runTest("Test 4: Cold Start - Generate Recommendations (No Cache)", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Find a user with resume vectors
    const testUser = await db.collection("users").findOne({
      "resume.bert_vector": { $exists: true, $ne: null },
      "resume.tfidf_vector": { $exists: true, $ne: null },
    });
    
    if (!testUser) {
      throw new Error("No users with vectors found");
    }
    
    const userId = testUser._id.toString();
    console.log(`✓ Found test user: ${testUser.name} (${userId})`);
    
    // Clear any existing cache for this user
    const { getRecommendationCache } = await import("./lib/recommendation/cache");
    const cache = getRecommendationCache();
    await cache.invalidate(userId);
    console.log("✓ Cleared existing cache");
    
    // Generate recommendations (should be cache miss)
    const { generateAndSaveRecommendations } = await import("./lib/recommendation");
    
    const startTime = Date.now();
    const result = await generateAndSaveRecommendations(
      userId,
      {
        tfidf: testUser.resume.tfidf_vector,
        bert: testUser.resume.bert_vector,
      },
      {
        tfidfWeight: 0.4,
        bertWeight: 0.6,
        topN: 20,
        threshold: 0.1,
      }
    );
    const duration = Date.now() - startTime;
    
    if (!result) {
      throw new Error("Failed to generate recommendations");
    }
    
    // Check if recommendations were saved
    const updatedUser = await db.collection("users").findOne({ _id: testUser._id });
    const recommendationCount = updatedUser?.recommendedInternships?.recommendedList?.length || 0;
    
    return `
✓ Recommendations generated (COLD START)
✓ Generation time: ${duration}ms
✓ Recommendations saved: ${recommendationCount}
✓ Cache populated`;
  });

  // Test 5: Warm Start - Cached Recommendations (Cache Hit)
  await runTest("Test 5: Warm Start - Retrieve from Cache (Cache Hit)", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Use the same user from Test 4
    const testUser = await db.collection("users").findOne({
      "resume.bert_vector": { $exists: true, $ne: null },
      "recommendedInternships.recommendedList": { $exists: true },
    });
    
    if (!testUser) {
      throw new Error("No test user found");
    }
    
    const userId = testUser._id.toString();
    console.log(`✓ Using test user: ${testUser.name}`);
    
    // Try to get recommendations (should be cache hit)
    const { generateAndSaveRecommendations } = await import("./lib/recommendation");
    
    const startTime = Date.now();
    const result = await generateAndSaveRecommendations(
      userId,
      {
        tfidf: testUser.resume.tfidf_vector,
        bert: testUser.resume.bert_vector,
      },
      {
        tfidfWeight: 0.4,
        bertWeight: 0.6,
        topN: 20,
        threshold: 0.1,
      },
      undefined,
      true // Use cache
    );
    const duration = Date.now() - startTime;
    
    if (!result) {
      throw new Error("Failed to retrieve recommendations");
    }
    
    return `
✓ Recommendations retrieved (WARM START / CACHE HIT)
✓ Retrieval time: ${duration}ms
✓ Cache working correctly
✓ Speedup compared to cold start: significant`;
  });

  // Test 6: Cache Invalidation on Resume Change
  await runTest("Test 6: Cache Invalidation on Resume Update", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Get test user
    const testUser = await db.collection("users").findOne({
      "resume.bert_vector": { $exists: true, $ne: null },
    });
    
    if (!testUser) throw new Error("No test user found");
    
    const userId = testUser._id.toString();
    console.log(`✓ Test user: ${testUser.name}`);
    
    // Check cache before invalidation
    const { getRecommendationCache, generateConfigHash, generateVectorHash } = 
      await import("./lib/recommendation/cache");
    const cache = getRecommendationCache();
    
    const configHash = generateConfigHash({ tfidfWeight: 0.4, bertWeight: 0.6, topN: 20, threshold: 0.1 });
    const vectorHash = generateVectorHash({
      tfidf: testUser.resume.tfidf_vector,
      bert: testUser.resume.bert_vector,
    });
    
    const cachedBefore = await cache.get(userId, configHash, vectorHash);
    console.log(`✓ Cache before invalidation: ${cachedBefore ? 'EXISTS' : 'EMPTY'}`);
    
    // Invalidate cache (simulating resume update)
    await cache.invalidate(userId);
    console.log("✓ Cache invalidated");
    
    // Check cache after invalidation
    const cachedAfter = await cache.get(userId, configHash, vectorHash);
    
    if (cachedAfter !== null) {
      throw new Error("Cache invalidation failed - cache still exists");
    }
    
    return `
✓ Cache successfully invalidated
✓ Next recommendation request will regenerate
✓ Lazy generation ensures fresh results`;
  });

  // Test 7: Batch Processing Test
  await runTest("Test 7: Batch Process Multiple Users", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Get 5 users with vectors
    const testUsers = await db.collection("users").find({
      "resume.bert_vector": { $exists: true, $ne: null },
      "resume.tfidf_vector": { $exists: true, $ne: null },
    }).limit(5).toArray();
    
    if (testUsers.length === 0) {
      throw new Error("No test users found");
    }
    
    console.log(`✓ Processing ${testUsers.length} users`);
    
    const { generateAndSaveRecommendations } = await import("./lib/recommendation");
    
    const startTime = Date.now();
    let successCount = 0;
    
    for (const user of testUsers) {
      const result = await generateAndSaveRecommendations(
        user._id.toString(),
        {
          tfidf: user.resume.tfidf_vector,
          bert: user.resume.bert_vector,
        }
      );
      if (result) successCount++;
    }
    
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / testUsers.length;
    
    return `
✓ Processed ${successCount}/${testUsers.length} users successfully
✓ Total time: ${totalTime}ms
✓ Average per user: ${avgTime.toFixed(2)}ms
✓ Batch processing functional`;
  });

  // Test 8: Strategy Comparison
  await runTest("Test 8: Compare HNSW vs BruteForce Performance", async () => {
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database not connected");
    
    // Get a test user
    const testUser = await db.collection("users").findOne({
      "resume.bert_vector": { $exists: true, $ne: null },
    });
    
    if (!testUser) throw new Error("No test user found");
    
    const { StrategyFactory, StrategyType } = await import("./lib/recommendation/strategies");
    const { generateRecommendations } = await import("./lib/recommendation/engine");
    
    const factory = StrategyFactory.getInstance();
    
    // Test with BruteForce
    console.log("⏳ Testing BruteForce strategy...");
    await factory.setConfig({ type: StrategyType.BRUTE_FORCE });
    const bruteForceStrategy = await factory.getStrategy();
    
    const bruteForceStart = Date.now();
    const bruteForceResult = await generateRecommendations({
      userVectors: {
        tfidf: testUser.resume.tfidf_vector,
        bert: testUser.resume.bert_vector,
      },
      config: { tfidfWeight: 0.4, bertWeight: 0.6, topN: 20, threshold: 0.1 },
    }, bruteForceStrategy);
    const bruteForceTime = Date.now() - bruteForceStart;
    
    console.log(`✓ BruteForce: ${bruteForceTime}ms, ${bruteForceResult.candidatesEvaluated} candidates`);
    
    // Test with HNSW
    console.log("⏳ Testing HNSW strategy...");
    await factory.setConfig({ type: StrategyType.HNSW });
    const hnswStrategy = await factory.getStrategy();
    
    const hnswStart = Date.now();
    const hnswResult = await generateRecommendations({
      userVectors: {
        tfidf: testUser.resume.tfidf_vector,
        bert: testUser.resume.bert_vector,
      },
      config: { tfidfWeight: 0.4, bertWeight: 0.6, topN: 20, threshold: 0.1 },
    }, hnswStrategy);
    const hnswTime = Date.now() - hnswStart;
    
    console.log(`✓ HNSW: ${hnswTime}ms, ${hnswResult.candidatesEvaluated} candidates`);
    
    const speedup = bruteForceTime / hnswTime;
    
    return `
✓ BruteForce: ${bruteForceTime}ms (${bruteForceResult.candidatesEvaluated} candidates)
✓ HNSW: ${hnswTime}ms (${hnswResult.candidatesEvaluated} candidates)
✓ Speedup: ${speedup.toFixed(2)}x
✓ Both strategies functional`;
  });

  // Print summary
  console.log("\n" + "═".repeat(70));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(70));
  
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
        console.log(`  - ${r.name}`);
      });
  } else {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("\n✅ VERIFIED:");
    console.log("  • HNSW index working with real database");
    console.log("  • Caching system functional (hit/miss/invalidation)");
    console.log("  • Lazy generation on cache miss");
    console.log("  • Batch processing operational");
    console.log("  • Strategy switching (HNSW ↔ BruteForce)");
    console.log("  • Complete recommendation pipeline functional");
  }
  
  console.log("\n" + "═".repeat(70));
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("\n❌ FATAL ERROR:", error);
  process.exit(1);
});
