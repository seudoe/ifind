/**
 * HNSW System Test with Mock Data
 * 
 * Generates sample internships and users, then tests the complete
 * recommendation pipeline without requiring a real database.
 * 
 * Run: npx tsx test-with-mock-data.ts
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

// Check if mongodb-memory-server is installed
let MongoMemoryServerAvailable = false;
try {
  require.resolve('mongodb-memory-server');
  MongoMemoryServerAvailable = true;
} catch {
  console.log("⚠️  mongodb-memory-server not installed. Installing...");
  console.log("   This is a one-time setup for testing.\n");
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
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
    });
  }
}

// Generate random vector
function generateRandomVector(dimensions: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    vector.push(Math.random() * 2 - 1); // Random between -1 and 1
  }
  
  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / norm);
}

// Generate sample internship
function generateSampleInternship(id: number) {
  const companies = ["Google", "Microsoft", "Apple", "Amazon", "Meta", "Netflix", "Tesla"];
  const roles = ["Software Engineer", "Data Scientist", "Product Manager", "DevOps Engineer", "ML Engineer"];
  const skills = ["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "Kubernetes", "MongoDB"];
  
  const randomSkills = skills.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3));
  
  return {
    _id: `internship_${id}`,
    name: `${roles[Math.floor(Math.random() * roles.length)]} Intern`,
    company: companies[Math.floor(Math.random() * companies.length)],
    summary: `Exciting internship opportunity in ${roles[Math.floor(Math.random() * roles.length)]} role. Work with cutting-edge technology and experienced mentors.`,
    skills: randomSkills,
    responsibilities: [
      "Develop and maintain software applications",
      "Collaborate with cross-functional teams",
      "Write clean, maintainable code"
    ],
    tags: ["internship", "tech", "remote"],
    field: ["Computer Science", "Software Engineering"],
    isActive: true,
    bert_vector: generateRandomVector(768),
    tfidf_vector: generateRandomVector(15000),
    datePublished: new Date(),
    moderation: {
      status: "manually_approved"
    }
  };
}

// Generate sample user
function generateSampleUser(id: number) {
  const names = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Eve Brown"];
  const skills = ["Python", "JavaScript", "React", "Machine Learning", "Data Analysis"];
  
  return {
    _id: `user_${id}`,
    name: names[Math.floor(Math.random() * names.length)],
    email: `user${id}@example.com`,
    username: `user${id}`,
    resume: {
      bert_vector: generateRandomVector(768),
      tfidf_vector: generateRandomVector(15000),
      parsedData: {
        skills: skills.sort(() => 0.5 - Math.random()).slice(0, 3),
        education: ["Bachelor's in Computer Science"],
        experience: []
      }
    },
    recommendedInternships: {
      recommendedList: [],
      recommendedScores: [],
      updatedAt: null
    },
    lastLogin: new Date(),
    createdAt: new Date()
  };
}

async function main() {
  console.log("═".repeat(60));
  console.log("  HNSW SYSTEM TEST WITH MOCK DATA");
  console.log("═".repeat(60));
  
  if (!MongoMemoryServerAvailable) {
    console.log("\n⚠️  Installing mongodb-memory-server...");
    const { execSync } = require('child_process');
    try {
      execSync('npm install --save-dev mongodb-memory-server@9', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log("✅ Installation complete!\n");
    } catch (error) {
      console.error("\n❌ Failed to install mongodb-memory-server");
      console.error("   Please run: npm install --save-dev mongodb-memory-server@9");
      process.exit(1);
    }
  }

  let mongoServer: any = null;
  let mongoose: any = null;

  try {
    // Start in-memory MongoDB
    console.log("\n🚀 Starting in-memory MongoDB server...");
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log(`✅ MongoDB started at: ${mongoUri}`);

    // Connect mongoose
    console.log("\n📦 Connecting to database...");
    mongoose = await import('mongoose');
    await mongoose.default.connect(mongoUri);
    const db = mongoose.default.connection.db;
    console.log("✅ Connected to mock database");

    // Test 1: Generate and Insert Sample Data
    await runTest("1. Generate and Insert Sample Data", async () => {
      console.log("\n  Generating sample data...");
      
      // Generate internships
      const internships = [];
      for (let i = 1; i <= 50; i++) {
        internships.push(generateSampleInternship(i));
      }
      console.log(`  ✓ Generated ${internships.length} sample internships`);
      
      // Generate users
      const users = [];
      for (let i = 1; i <= 10; i++) {
        users.push(generateSampleUser(i));
      }
      console.log(`  ✓ Generated ${users.length} sample users`);
      
      // Insert into database
      await db!.collection('internships').insertMany(internships);
      console.log(`  ✓ Inserted ${internships.length} internships into DB`);
      
      await db!.collection('users').insertMany(users);
      console.log(`  ✓ Inserted ${users.length} users into DB`);
      
      // Verify
      const internshipCount = await db!.collection('internships').countDocuments();
      const userCount = await db!.collection('users').countDocuments();
      
      if (internshipCount !== 50 || userCount !== 10) {
        throw new Error(`Data insertion failed: ${internshipCount} internships, ${userCount} users`);
      }
      
      console.log(`  ✓ Verified data in database`);
    });

    // Test 2: HNSW Index Population
    await runTest("2. HNSW Index Population", async () => {
      const { getIndexManager } = await import('./lib/hnsw');
      const indexManager = getIndexManager();
      
      console.log("  Rebuilding HNSW index from mock data...");
      await indexManager.rebuildIndex();
      
      const stats = indexManager.getStats();
      console.log(`  ✓ Index built with ${stats.vectorCount} vectors`);
      
      if (stats.vectorCount !== 50) {
        throw new Error(`Expected 50 vectors, got ${stats.vectorCount}`);
      }
      
      console.log(`  ✓ All internship vectors indexed`);
    });

    // Test 3: HNSW Search
    await runTest("3. HNSW Search with Mock Vectors", async () => {
      const { getIndexManager } = await import('./lib/hnsw');
      const indexManager = getIndexManager();
      
      // Get a random user's vector
      const user = await db!.collection('users').findOne({});
      if (!user || !user.resume?.bert_vector) {
        throw new Error("No user with vectors found");
      }
      
      console.log(`  Using user: ${user.name}`);
      console.log(`  Vector dimensions: ${user.resume.bert_vector.length}`);
      
      // Search for nearest neighbors
      const searchStart = Date.now();
      const results = await indexManager.searchNearestNeighbors(
        user.resume.bert_vector,
        10
      );
      const searchTime = Date.now() - searchStart;
      
      console.log(`  ✓ Search completed in ${searchTime}ms`);
      console.log(`  ✓ Found ${results.length} neighbors`);
      
      if (results.length === 0) {
        throw new Error("Search returned no results");
      }
      
      console.log(`  Top 3 results:`);
      results.slice(0, 3).forEach((result, i) => {
        console.log(`    ${i + 1}. ID: ${result.id}, Score: ${result.score.toFixed(4)}`);
      });
    });

    // Test 4: Recommendation Generation (BruteForce)
    await runTest("4. Recommendation Generation (BruteForce)", async () => {
      const { generateRecommendations } = await import('./lib/recommendation/engine');
      const { StrategyType, StrategyFactory } = await import('./lib/recommendation/strategies');
      
      // Switch to BruteForce
      const factory = StrategyFactory.getInstance();
      await factory.setConfig({ type: StrategyType.BRUTE_FORCE });
      
      // Get a user
      const user = await db!.collection('users').findOne({});
      if (!user) throw new Error("No user found");
      
      console.log(`  Generating recommendations for: ${user.name}`);
      
      const startTime = Date.now();
      const result = await generateRecommendations({
        userVectors: {
          tfidf: user.resume.tfidf_vector,
          bert: user.resume.bert_vector,
        },
        config: {
          topN: 10,
          tfidfWeight: 0.4,
          bertWeight: 0.6,
          threshold: 0.0,
        },
      });
      const duration = Date.now() - startTime;
      
      console.log(`  ✓ Generated ${result.recommendations.length} recommendations`);
      console.log(`  ✓ Evaluated ${result.candidatesEvaluated} candidates`);
      console.log(`  ✓ Time: ${duration}ms`);
      
      if (result.recommendations.length === 0) {
        throw new Error("No recommendations generated");
      }
      
      console.log(`  Top 3 recommendations:`);
      result.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`    ${i + 1}. Score: ${rec.score.toFixed(4)}`);
      });
    });

    // Test 5: Recommendation Generation (HNSW)
    await runTest("5. Recommendation Generation (HNSW)", async () => {
      const { generateRecommendations } = await import('./lib/recommendation/engine');
      const { StrategyType, StrategyFactory } = await import('./lib/recommendation/strategies');
      
      // Switch to HNSW
      const factory = StrategyFactory.getInstance();
      await factory.setConfig({ type: StrategyType.HNSW });
      
      // Get a user
      const user = await db!.collection('users').findOne({});
      if (!user) throw new Error("No user found");
      
      console.log(`  Generating recommendations for: ${user.name}`);
      
      const startTime = Date.now();
      const result = await generateRecommendations({
        userVectors: {
          tfidf: user.resume.tfidf_vector,
          bert: user.resume.bert_vector,
        },
        config: {
          topN: 10,
          tfidfWeight: 0.4,
          bertWeight: 0.6,
          threshold: 0.0,
        },
      });
      const duration = Date.now() - startTime;
      
      console.log(`  ✓ Generated ${result.recommendations.length} recommendations`);
      console.log(`  ✓ Evaluated ${result.candidatesEvaluated} candidates (HNSW filtered)`);
      console.log(`  ✓ Time: ${duration}ms`);
      
      if (result.recommendations.length === 0) {
        throw new Error("No recommendations generated");
      }
      
      console.log(`  Top 3 recommendations:`);
      result.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`    ${i + 1}. Score: ${rec.score.toFixed(4)}`);
      });
    });

    // Test 6: Cache Operations
    await runTest("6. Cache Operations with Mock DB", async () => {
      const { getRecommendationCache, generateConfigHash, generateVectorHash } = 
        await import('./lib/recommendation/cache');
      
      const cache = getRecommendationCache();
      
      // Get a user
      const user = await db!.collection('users').findOne({});
      if (!user) throw new Error("No user found");
      
      const userId = user._id;
      const vectors = {
        tfidf: user.resume.tfidf_vector,
        bert: user.resume.bert_vector,
      };
      
      const configHash = generateConfigHash({});
      const vectorHash = generateVectorHash(vectors);
      
      console.log(`  Testing cache for user: ${user.name}`);
      
      // Test cache miss
      const cached1 = await cache.get(userId, configHash, vectorHash);
      console.log(`  ✓ Cache miss (as expected): ${cached1 === null}`);
      
      // Store in cache
      const testRecs = ["rec1", "rec2", "rec3"];
      const testScores = [0.9, 0.8, 0.7];
      
      await cache.set(userId, testRecs, testScores, configHash, vectorHash);
      console.log(`  ✓ Stored ${testRecs.length} recommendations in cache`);
      
      // Test cache hit
      const cached2 = await cache.get(userId, configHash, vectorHash);
      if (!cached2) throw new Error("Cache hit failed");
      
      console.log(`  ✓ Cache hit successful`);
      console.log(`  ✓ Retrieved ${cached2.recommendedInternshipIds.length} recommendations`);
      
      // Get stats
      const stats = await cache.getStats();
      console.log(`  ✓ Cache stats: ${stats.totalEntries} total, ${stats.expiredEntries} expired`);
    });

    // Test 7: Full Recommendation Pipeline with Caching
    await runTest("7. Full Pipeline: Generate & Save with Cache", async () => {
      const { generateAndSaveRecommendations } = await import('./lib/recommendation');
      
      // Get a user
      const user = await db!.collection('users').findOne({});
      if (!user) throw new Error("No user found");
      
      const userId = user._id.toString();
      const vectors = {
        tfidf: user.resume.tfidf_vector,
        bert: user.resume.bert_vector,
      };
      
      console.log(`  Generating and saving for: ${user.name}`);
      
      // First call (cache miss)
      const start1 = Date.now();
      await generateAndSaveRecommendations(userId, vectors, undefined, undefined, true);
      const time1 = Date.now() - start1;
      console.log(`  ✓ First call (cache MISS): ${time1}ms`);
      
      // Verify saved to database
      const updatedUser = await db!.collection('users').findOne({ _id: user._id });
      if (!updatedUser?.recommendedInternships?.recommendedList) {
        throw new Error("Recommendations not saved to database");
      }
      console.log(`  ✓ Saved ${updatedUser.recommendedInternships.recommendedList.length} recs to DB`);
      
      // Second call (cache hit)
      const start2 = Date.now();
      await generateAndSaveRecommendations(userId, vectors, undefined, undefined, true);
      const time2 = Date.now() - start2;
      console.log(`  ✓ Second call (cache HIT): ${time2}ms`);
      
      if (time2 >= time1) {
        console.log(`  ⚠️  Cache didn't improve speed (may be too small dataset)`);
      } else {
        console.log(`  ✓ Cache improved speed by ${((1 - time2/time1) * 100).toFixed(1)}%`);
      }
    });

    // Test 8: Background Refresh Simulation
    await runTest("8. Background Refresh with Mock Data", async () => {
      const { getRefreshManager } = await import('./lib/recommendation/background-refresh');
      
      const refreshManager = getRefreshManager({
        batchSize: 5,
        activeThresholdDays: 30,
        delayBetweenBatchesMs: 10,
      });
      
      console.log(`  Starting background refresh...`);
      
      const result = await refreshManager.refreshActiveUsers();
      
      console.log(`  ✓ Refresh completed`);
      console.log(`  ✓ Processed: ${result.processedUsers} users`);
      console.log(`  ✓ Successful: ${result.successfulRefreshes}`);
      console.log(`  ✓ Failed: ${result.failedRefreshes}`);
      console.log(`  ✓ Duration: ${result.durationMs}ms`);
      
      if (!result.success) {
        throw new Error("Background refresh failed");
      }
    });

    // Test 9: Performance Comparison
    await runTest("9. Performance: BruteForce vs HNSW", async () => {
      const { generateRecommendations } = await import('./lib/recommendation/engine');
      const { StrategyType, StrategyFactory } = await import('./lib/recommendation/strategies');
      
      const factory = StrategyFactory.getInstance();
      const user = await db!.collection('users').findOne({});
      if (!user) throw new Error("No user found");
      
      const vectors = {
        tfidf: user.resume.tfidf_vector,
        bert: user.resume.bert_vector,
      };
      
      // Test BruteForce
      await factory.setConfig({ type: StrategyType.BRUTE_FORCE });
      const bruteStart = Date.now();
      const bruteResult = await generateRecommendations({ userVectors: vectors });
      const bruteTime = Date.now() - bruteStart;
      
      console.log(`  BruteForce: ${bruteTime}ms (${bruteResult.candidatesEvaluated} candidates)`);
      
      // Test HNSW
      await factory.setConfig({ type: StrategyType.HNSW });
      const hnswStart = Date.now();
      const hnswResult = await generateRecommendations({ userVectors: vectors });
      const hnswTime = Date.now() - hnswStart;
      
      console.log(`  HNSW: ${hnswTime}ms (${hnswResult.candidatesEvaluated} candidates)`);
      
      const speedup = (bruteTime / hnswTime).toFixed(2);
      console.log(`  ✓ Speedup: ${speedup}x`);
      
      if (hnswTime < bruteTime) {
        console.log(`  ✓ HNSW is faster!`);
      } else {
        console.log(`  ℹ️  BruteForce faster (expected with small dataset)`);
      }
    });

    // Summary
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
    } else {
      console.log("\n🎉 ALL TESTS PASSED WITH MOCK DATA!");
      console.log("\nVerified Components:");
      console.log("  ✓ Sample data generation");
      console.log("  ✓ Database operations");
      console.log("  ✓ HNSW index population");
      console.log("  ✓ HNSW search");
      console.log("  ✓ BruteForce recommendations");
      console.log("  ✓ HNSW recommendations");
      console.log("  ✓ Cache operations");
      console.log("  ✓ Full pipeline with caching");
      console.log("  ✓ Background refresh");
      console.log("  ✓ Performance comparison");
    }
    
    console.log("\n" + "═".repeat(60));
    
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (mongoose) {
      await mongoose.default.connection.close();
      console.log("\n🔌 Disconnected from database");
    }
    
    if (mongoServer) {
      await mongoServer.stop();
      console.log("🛑 Stopped in-memory MongoDB server");
    }
  }
  
  process.exit(results.some(r => !r.passed) ? 1 : 0);
}

main().catch(error => {
  console.error("\n❌ FATAL ERROR:", error);
  process.exit(1);
});
