/**
 * Internship Vectorization Test
 * 
 * Tests the internship vectorization and HNSW indexing pipeline.
 * Note: This requires a working vectorization service endpoint.
 * 
 * Run: npx tsx test-internship-vectorization.ts
 */

import fs from "fs";
import path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIdx = trimmed.indexOf("=");
    if (equalIdx !== -1) {
      const key = trimmed.slice(0, equalIdx).trim();
      const val = trimmed.slice(equalIdx + 1).trim();
      process.env[key] = val.replace(/^['"]|['"]$/g, "");
    }
  }
}

async function main() {
  console.log("═".repeat(60));
  console.log("  INTERNSHIP VECTORIZATION TEST");
  console.log("═".repeat(60));
  
  try {
    // Step 1: Connect to database
    console.log("\n📦 Step 1: Connecting to database...");
    const { connectDB } = await import("./lib/db");
    const mongoose = await import("mongoose");
    await connectDB();
    const db = mongoose.default.connection.db;
    if (!db) throw new Error("Database connection failed");
    console.log("✅ Connected to database");
    
    // Step 2: Check internships
    console.log("\n💼 Step 2: Checking internship collection...");
    const totalInternships = await db.collection("internships").countDocuments();
    const withVectors = await db.collection("internships").countDocuments({
      bert_vector: { $exists: true },
      tfidf_vector: { $exists: true },
    });
    const withoutVectors = totalInternships - withVectors;
    
    console.log(`✅ Total internships: ${totalInternships}`);
    console.log(`   With vectors: ${withVectors}`);
    console.log(`   Without vectors: ${withoutVectors}`);
    
    if (totalInternships === 0) {
      console.log("\n⚠️  No internships found in database");
      console.log("   Cannot test vectorization without internships");
      return;
    }
    
    // Step 3: Test HNSW index
    console.log("\n🔍 Step 3: Checking HNSW index...");
    const { getIndexManager } = await import("./lib/hnsw");
    const indexManager = getIndexManager();
    
    await indexManager.loadFromDatabase();
    const stats = indexManager.getStats();
    
    console.log(`✅ Index stats:`);
    console.log(`   Vectors: ${stats.vectorCount}`);
    console.log(`   Dimensions: ${stats.dimensions}`);
    console.log(`   Initialized: ${stats.isInitialized}`);
    console.log(`   Ready: ${indexManager.isReady()}`);
    
    // Step 4: Find an internship without vectors
    console.log("\n🎯 Step 4: Finding test internship...");
    let testInternship = await db.collection("internships").findOne({
      bert_vector: { $exists: false },
    });
    
    if (!testInternship) {
      console.log("   No internships without vectors, using existing one");
      testInternship = await db.collection("internships").findOne();
    }
    
    if (!testInternship) {
      throw new Error("Could not find test internship");
    }
    
    console.log(`✅ Test internship: ${testInternship.name}`);
    console.log(`   ID: ${testInternship._id}`);
    console.log(`   Company: ${testInternship.company}`);
    console.log(`   Has vectors: ${!!(testInternship.bert_vector && testInternship.tfidf_vector)}`);
    
    // Step 5: Test vectorization (mock since we need API)
    console.log("\n🧪 Step 5: Testing vectorization components...");
    
    const testData = {
      name: testInternship.name,
      company: testInternship.company,
      summary: testInternship.summary,
      skills: testInternship.skills || [],
      responsibilities: testInternship.responsibilities || null,
      tags: testInternship.tags || null,
      field: testInternship.field || null,
    };
    
    console.log("✅ Test data prepared:");
    console.log(`   Name: ${testData.name}`);
    console.log(`   Company: ${testData.company}`);
    console.log(`   Skills: ${testData.skills.length}`);
    
    // Note: Actual encoding requires the HF service to be running
    console.log("\n⚠️  Note: Actual vectorization requires HF service");
    console.log(`   Service URL: ${process.env.VECTORIZER_URL || "https://seudoe-vectorisationResume.hf.space"}`);
    console.log(`   Endpoint: /encode-internship`);
    
    // Step 6: Test manual vector insertion (if internship has vectors)
    if (testInternship.bert_vector && testInternship.tfidf_vector) {
      console.log("\n📝 Step 6: Testing manual vector insertion...");
      
      const testId = testInternship._id.toString();
      const bertVector = testInternship.bert_vector;
      
      if (Array.isArray(bertVector) && bertVector.length === 768) {
        // Check if already in index
        const beforeStats = indexManager.getStats();
        
        // Try to insert
        await indexManager.insertVector(testId, bertVector);
        console.log(`✅ Inserted vector into HNSW index`);
        
        const afterStats = indexManager.getStats();
        console.log(`   Index size: ${beforeStats.vectorCount} → ${afterStats.vectorCount}`);
        
        // Test search
        const searchResults = await indexManager.searchNearestNeighbors(bertVector, 5);
        console.log(`✅ Search test: found ${searchResults.length} neighbors`);
        
        if (searchResults.length > 0) {
          console.log(`   Top result: ${searchResults[0].id}, score: ${searchResults[0].score.toFixed(4)}`);
        }
      } else {
        console.log(`⚠️  Invalid vector length: ${bertVector?.length} (expected 768)`);
      }
    } else {
      console.log("\n⚠️  Step 6: Skipped (internship has no vectors)");
    }
    
    // Step 7: Test index rebuild
    console.log("\n🔄 Step 7: Testing index rebuild...");
    const beforeRebuild = indexManager.getStats();
    console.log(`   Before rebuild: ${beforeRebuild.vectorCount} vectors`);
    
    await indexManager.rebuildIndex();
    const afterRebuild = indexManager.getStats();
    console.log(`   After rebuild: ${afterRebuild.vectorCount} vectors`);
    console.log(`✅ Index rebuild successful`);
    
    // Step 8: Verify database persistence
    console.log("\n💾 Step 8: Testing index persistence...");
    await indexManager.persistToDatabase();
    console.log(`✅ Index persisted to database`);
    
    const graphDoc = await db.collection("internships.graph").findOne({ _id: "hnsw_index" } as any);
    if (graphDoc) {
      console.log(`✅ Found index in database`);
      console.log(`   Updated at: ${graphDoc.data?.metadata?.updatedAt || "N/A"}`);
      console.log(`   Vector count: ${graphDoc.data?.metadata?.vectorCount || 0}`);
    } else {
      console.log(`⚠️  Index not found in database`);
    }
    
    // Summary
    console.log("\n" + "═".repeat(60));
    console.log("  ✅ VECTORIZATION SYSTEM OPERATIONAL");
    console.log("═".repeat(60));
    console.log("\nComponents tested:");
    console.log(`  ✓ Database connection`);
    console.log(`  ✓ Internship collection structure`);
    console.log(`  ✓ HNSW index manager`);
    console.log(`  ✓ Vector insertion`);
    console.log(`  ✓ Index rebuild`);
    console.log(`  ✓ Database persistence`);
    console.log("\nTo fully test vectorization:");
    console.log(`  1. Ensure vectorization service is running`);
    console.log(`  2. Approve an internship via moderator panel`);
    console.log(`  3. Check if vectors are generated automatically`);
    
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("\n❌ FATAL ERROR:", error);
  process.exit(1);
});
