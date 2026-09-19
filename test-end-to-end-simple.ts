/**
 * Simple End-to-End Test with Generated Data
 * 
 * Tests the complete HNSW recommendation system with mock data
 * WITHOUT requiring MongoDB (uses in-memory storage only).
 * 
 * Run: npx tsx test-end-to-end-simple.ts
 */

console.log("═".repeat(60));
console.log("  END-TO-END HNSW TEST WITH GENERATED DATA");
console.log("═".repeat(60));

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
  console.log("─".repeat(60));
  
  try {
    const details = await testFn();
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    results.push({ name, passed: true, duration, details });
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ FAILED (${duration}ms)`);
    console.error("Error:", error);
    results.push({ name, passed: false, duration });
  }
}

// Generate random normalized vector
function generateVector(dimensions: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    vector.push(Math.random() * 2 - 1);
  }
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / norm);
}

// Mock internship type
interface MockInternship {
  id: string;
  name: string;
  company: string;
  skills: string[];
  bertVector: number[];
  tfidfVector: number[];
}

// Mock user type
interface MockUser {
  id: string;
  name: string;
  bertVector: number[];
  tfidfVector: number[];
}

async function main() {
  // Test 1: Generate Mock Data
  let mockInternships: MockInternship[] = [];
  let mockUsers: MockUser[] = [];
  
  await runTest("Test 1: Generate Mock Data", async () => {
    const companies = ["Google", "Microsoft", "Apple", "Amazon", "Meta"];
    const roles = ["Software Engineer", "Data Scientist", "ML Engineer"];
    const skillsList = [
      ["Python", "TensorFlow", "AWS"],
      ["JavaScript", "React", "Node.js"],
      ["Java", "Spring", "Kubernetes"],
      ["Python", "Django", "PostgreSQL"],
      ["C++", "Algorithms", "System Design"]
    ];
    
    // Generate 50 internships
    for (let i = 0; i < 50; i++) {
      mockInternships.push({
        id: `internship_${i + 1}`,
        name: `${roles[i % roles.length]} Intern`,
        company: companies[i % companies.length],
        skills: skillsList[i % skillsList.length],
        bertVector: generateVector(768),
        tfidfVector: generateVector(15000),
      });
    }
    
    // Generate 10 users
    for (let i = 0; i < 10; i++) {
      mockUsers.push({
        id: `user_${i + 1}`,
        name: `Test User ${i + 1}`,
        bertVector: generateVector(768),
        tfidfVector: generateVector(15000),
      });
    }
    
    console.log(`  ✓ Generated ${mockInternships.length} internships`);
    console.log(`  ✓ Generated ${mockUsers.length} users`);
    return `Created ${mockInternships.length} internships and ${mockUsers.length} users`;
  });
  
  // Test 2: Populate HNSW Index
  await runTest("Test 2: Populate HNSW Index", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    // Reset index
    await indexManager.initialize();
    
    // Insert all internship vectors
    let inserted = 0;
    for (const internship of mockInternships) {
      await indexManager.insertVector(internship.id, internship.bertVector);
      inserted++;
    }
    
    const stats = indexManager.getStats();
    console.log(`  ✓ Inserted ${inserted} vectors`);
    console.log(`  ✓ Index size: ${stats.vectorCount} vectors`);
    console.log(`  ✓ Dimensions: ${stats.dimensions}`);
    console.log(`  ✓ Index ready: ${indexManager.isReady()}`);
    
    if (stats.vectorCount !== mockInternships.length) {
      throw new Error(`Expected ${mockInternships.length} vectors, got ${stats.vectorCount}`);
    }
    
    return `Indexed ${stats.vectorCount} vectors`;
  });
  
  // Test 3: HNSW Search Performance
  await runTest("Test 3: HNSW Search Performance", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    const testUser = mockUsers[0];
    console.log(`  Testing search for: ${testUser.name}`);
    
    const searchStart = Date.now();
    const results = await indexManager.searchNearestNeighbors(
      testUser.bertVector,
      10
    );
    const searchTime = Date.now() - searchStart;
    
    console.log(`  ✓ Found ${results.length} nearest neighbors`);
    console.log(`  ✓ Search time: ${searchTime}ms`);
    console.log(`  ✓ Top 3 results:`);
    results.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.id} (score: ${r.score.toFixed(4)})`);
    });
    
    if (results.length === 0) {
      throw new Error("Search returned no results");
    }
    
    return `Found ${results.length} neighbors in ${searchTime}ms`;
  });
  
  // Test 4: Compute Similarity Scores
  await runTest("Test 4: Compute Weighted Similarity Scores", async () => {
    const testUser = mockUsers[0];
    
    // Compute cosine similarity manually
    const cosineSim = (a: number[], b: number[]): number => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };
    
    const scores: Array<{ id: string; score: number }> = [];
    
    // Calculate scores for first 10 internships
    for (const internship of mockInternships.slice(0, 10)) {
      const tfidfSim = cosineSim(testUser.tfidfVector, internship.tfidfVector);
      const bertSim = cosineSim(testUser.bertVector, internship.bertVector);
      const weightedScore = tfidfSim * 0.4 + bertSim * 0.6;
      
      scores.push({ id: internship.id, score: weightedScore });
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    console.log(`  ✓ Computed scores for 10 candidates`);
    console.log(`  ✓ Top 3 by weighted score:`);
    scores.slice(0, 3).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.id} (score: ${s.score.toFixed(4)})`);
    });
    
    return `Top score: ${scores[0].score.toFixed(4)}`;
  });
  
  // Test 5: Mock Recommendation Pipeline
  await runTest("Test 5: Full Recommendation Pipeline (Mock)", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    const testUser = mockUsers[0];
    console.log(`  Generating recommendations for: ${testUser.name}`);
    
    const pipelineStart = Date.now();
    
    // Step 1: HNSW search (get top 20 candidates)
    const hnswStart = Date.now();
    const candidates = await indexManager.searchNearestNeighbors(
      testUser.bertVector,
      20
    );
    const hnswTime = Date.now() - hnswStart;
    console.log(`  ✓ HNSW retrieval: ${hnswTime}ms (${candidates.length} candidates)`);
    
    // Step 2: Compute exact cosine similarity
    const scoringStart = Date.now();
    const cosineSim = (a: number[], b: number[]): number => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };
    
    const scored: Array<{ id: string; score: number }> = [];
    for (const candidate of candidates) {
      const internship = mockInternships.find(i => i.id === candidate.id);
      if (!internship) continue;
      
      const tfidfSim = cosineSim(testUser.tfidfVector, internship.tfidfVector);
      const bertSim = cosineSim(testUser.bertVector, internship.bertVector);
      const weightedScore = tfidfSim * 0.4 + bertSim * 0.6;
      
      scored.push({ id: internship.id, score: weightedScore });
    }
    
    // Step 3: Sort and filter
    scored.sort((a, b) => b.score - a.score);
    const threshold = 0.0;
    const filtered = scored.filter(s => s.score >= threshold);
    const topN = filtered.slice(0, 10);
    
    const scoringTime = Date.now() - scoringStart;
    const totalTime = Date.now() - pipelineStart;
    
    console.log(`  ✓ Exact scoring: ${scoringTime}ms`);
    console.log(`  ✓ Total pipeline: ${totalTime}ms`);
    console.log(`  ✓ Final recommendations: ${topN.length}`);
    console.log(`  ✓ Top 3:`);
    topN.slice(0, 3).forEach((rec, i) => {
      const internship = mockInternships.find(int => int.id === rec.id);
      console.log(`    ${i + 1}. ${internship?.company} - ${internship?.name} (${rec.score.toFixed(4)})`);
    });
    
    return `Generated ${topN.length} recommendations in ${totalTime}ms`;
  });
  
  // Test 6: Compare with Brute Force
  await runTest("Test 6: Performance Comparison (HNSW vs Brute-Force)", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    const testUser = mockUsers[1];
    
    const cosineSim = (a: number[], b: number[]): number => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };
    
    // HNSW approach
    const hnswStart = Date.now();
    const hnswCandidates = await indexManager.searchNearestNeighbors(
      testUser.bertVector,
      20
    );
    const hnswScored = hnswCandidates.map(c => {
      const internship = mockInternships.find(i => i.id === c.id)!;
      return {
        id: c.id,
        score: cosineSim(testUser.bertVector, internship.bertVector) * 0.6 +
               cosineSim(testUser.tfidfVector, internship.tfidfVector) * 0.4
      };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
    const hnswTime = Date.now() - hnswStart;
    
    // Brute-force approach
    const bruteStart = Date.now();
    const bruteScored = mockInternships.map(internship => {
      return {
        id: internship.id,
        score: cosineSim(testUser.bertVector, internship.bertVector) * 0.6 +
               cosineSim(testUser.tfidfVector, internship.tfidfVector) * 0.4
      };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
    const bruteTime = Date.now() - bruteStart;
    
    console.log(`  HNSW approach:`);
    console.log(`    - Time: ${hnswTime}ms`);
    console.log(`    - Candidates evaluated: ${hnswCandidates.length}`);
    console.log(`    - Top score: ${hnswScored[0].score.toFixed(4)}`);
    
    console.log(`  Brute-force approach:`);
    console.log(`    - Time: ${bruteTime}ms`);
    console.log(`    - Candidates evaluated: ${mockInternships.length}`);
    console.log(`    - Top score: ${bruteScored[0].score.toFixed(4)}`);
    
    const speedup = (bruteTime / hnswTime).toFixed(2);
    console.log(`  ✓ HNSW speedup: ${speedup}x`);
    
    if (hnswTime < bruteTime) {
      console.log(`  ✓ HNSW is faster!`);
    } else {
      console.log(`  ℹ️  Similar performance (expected with only 50 internships)`);
    }
    
    return `HNSW: ${hnswTime}ms, Brute: ${bruteTime}ms, Speedup: ${speedup}x`;
  });
  
  // Test 7: Multiple User Batch
  await runTest("Test 7: Batch Process Multiple Users", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    console.log(`  Processing ${mockUsers.length} users...`);
    
    const batchStart = Date.now();
    const allRecommendations: Array<{ userId: string; recCount: number }> = [];
    
    for (const user of mockUsers) {
      const results = await indexManager.searchNearestNeighbors(
        user.bertVector,
        10
      );
      allRecommendations.push({
        userId: user.id,
        recCount: results.length
      });
    }
    
    const batchTime = Date.now() - batchStart;
    const avgTime = (batchTime / mockUsers.length).toFixed(2);
    
    console.log(`  ✓ Processed ${mockUsers.length} users in ${batchTime}ms`);
    console.log(`  ✓ Average per user: ${avgTime}ms`);
    console.log(`  ✓ All users got recommendations: ${allRecommendations.every(r => r.recCount > 0)}`);
    
    return `${mockUsers.length} users in ${batchTime}ms (avg: ${avgTime}ms/user)`;
  });
  
  // Test 8: Index Operations (Insert/Delete)
  await runTest("Test 8: Dynamic Index Operations", async () => {
    const { getIndexManager } = await import('./lib/hnsw');
    const indexManager = getIndexManager();
    
    const initialStats = indexManager.getStats();
    console.log(`  Initial size: ${initialStats.vectorCount}`);
    
    // Add a new internship
    const newInternship = {
      id: "new_internship_test",
      bertVector: generateVector(768),
    };
    
    await indexManager.insertVector(newInternship.id, newInternship.bertVector);
    const afterInsert = indexManager.getStats();
    console.log(`  ✓ After insert: ${afterInsert.vectorCount}`);
    
    if (afterInsert.vectorCount !== initialStats.vectorCount + 1) {
      throw new Error("Insert failed");
    }
    
    // Search should find it
    const searchResults = await indexManager.searchNearestNeighbors(
      newInternship.bertVector,
      5
    );
    const foundNew = searchResults.some(r => r.id === newInternship.id);
    console.log(`  ✓ New internship searchable: ${foundNew}`);
    
    // Delete it
    await indexManager.deleteVector(newInternship.id);
    const afterDelete = indexManager.getStats();
    console.log(`  ✓ After delete: ${afterDelete.vectorCount}`);
    
    if (afterDelete.vectorCount !== initialStats.vectorCount) {
      throw new Error("Delete failed");
    }
    
    return `Insert/Delete successful, final size: ${afterDelete.vectorCount}`;
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
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
    });
  } else {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("\n✅ Verified Functionality:");
    console.log("  ✓ Mock data generation (50 internships, 10 users)");
    console.log("  ✓ HNSW index population");
    console.log("  ✓ HNSW search performance");
    console.log("  ✓ Similarity score computation");
    console.log("  ✓ Complete recommendation pipeline");
    console.log("  ✓ Performance comparison (HNSW vs Brute-Force)");
    console.log("  ✓ Batch processing");
    console.log("  ✓ Dynamic index operations (insert/delete)");
    
    console.log("\n📊 Performance Summary:");
    results.forEach(r => {
      if (r.details) {
        console.log(`  • ${r.name}: ${r.details}`);
      }
    });
  }
  
  console.log("\n" + "═".repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("\n❌ FATAL ERROR:", error);
  process.exit(1);
});
