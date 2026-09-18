# Recommendation Engine

A modular, scalable recommendation service for generating personalized internship recommendations.

## Architecture Overview

The recommendation engine is designed with clear separation of concerns, making it easy to swap out retrieval strategies (e.g., from brute-force to HNSW) without affecting the rest of the application.

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (API Routes, Controllers, Background Jobs)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Recommendation Service (index.ts)               │
│  • generateAndSaveRecommendations()                          │
│  • Public API for the recommendation system                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Recommendation Engine (engine.ts)                 │
│  • generateRecommendations()                                 │
│  • Orchestrates retrieval, scoring, filtering, ranking       │
└───────┬──────────────────────────────────┬──────────────────┘
        │                                  │
        ▼                                  ▼
┌──────────────────┐              ┌─────────────────────────┐
│  Retrieval Layer │              │   Scoring Layer         │
│  (retrieval.ts)  │              │   (scoring.ts)          │
│                  │              │                         │
│  • Fetch         │              │  • Vector similarity    │
│    candidates    │              │  • Score computation    │
│                  │              │  • Dot product          │
└──────────────────┘              └─────────────────────────┘
```

## Module Breakdown

### 1. **types.ts** - Type Definitions
Core TypeScript interfaces and types:
- `VectorEmbeddings` - TF-IDF and BERT vectors
- `InternshipCandidate` - Candidate internship with vectors
- `ScoredRecommendation` - Recommendation with similarity score
- `RecommendationConfig` - Configuration for generation
- `RecommendationResult` - Result with recommendations and metadata

### 2. **scoring.ts** - Similarity Computation
Mathematical operations for scoring:
- `dotProduct()` - Vector dot product computation
- `computeSimilarityScore()` - Weighted TF-IDF + BERT similarity

### 3. **retrieval.ts** - Candidate Fetching
Abstracts the data source for internship candidates:
- `fetchInternshipCandidates()` - Retrieves active internships with vectors

**Current Implementation**: Brute-force (loads all candidates)
**Future**: Can be replaced with HNSW-based approximate nearest neighbors

### 4. **engine.ts** - Recommendation Generation
Core recommendation pipeline orchestration:
- `generateRecommendations()` - Main entry point
  1. Retrieve candidates
  2. Score each candidate
  3. Filter by threshold
  4. Sort by score
  5. Return top N

### 5. **index.ts** - Public API
Main service interface:
- `generateAndSaveRecommendations()` - Generate and persist recommendations

## Usage

### Basic Usage

```typescript
import { generateAndSaveRecommendations } from '@/lib/recommendation';

// Generate recommendations for a user
const success = await generateAndSaveRecommendations(
  userId,
  {
    tfidf: userTfidfVector,
    bert: userBertVector,
  }
);
```

### With Custom Configuration

```typescript
import { generateAndSaveRecommendations } from '@/lib/recommendation';

const success = await generateAndSaveRecommendations(
  userId,
  userVectors,
  {
    topN: 30,           // Return top 30 instead of default 20
    threshold: 0.15,    // Higher threshold for quality
    tfidfWeight: 0.5,   // Equal weights
    bertWeight: 0.5,
  }
);
```

## Configuration

Default configuration (defined in `engine.ts`):

```typescript
{
  tfidfWeight: 0.4,   // Weight for TF-IDF similarity
  bertWeight: 0.6,    // Weight for BERT similarity
  topN: 20,           // Maximum recommendations to return
  threshold: 0.1,     // Minimum score threshold
}
```

## Current Behavior

- **Retrieval**: Brute-force (loads all active internships)
- **Scoring**: Weighted combination of TF-IDF (40%) and BERT (60%) similarities
- **Filtering**: Removes candidates below 0.1 threshold
- **Ranking**: Sorts by score descending
- **Output**: Top 20 recommendations

## Future Enhancements

This architecture is designed to support:

1. **HNSW Integration** - Replace `retrieval.ts` with approximate nearest neighbor search
2. **Caching Layer** - Add Redis/in-memory cache for frequent queries
3. **A/B Testing** - Support multiple recommendation strategies
4. **Explainability** - Add detailed scoring breakdowns
5. **Personalization** - Incorporate user preferences, history, etc.

## Testing

The modular design makes testing straightforward:

```typescript
// Test scoring independently
import { computeSimilarityScore } from '@/lib/recommendation/scoring';

const score = computeSimilarityScore(
  userTfidf, userBert,
  internshipTfidf, internshipBert
);

// Test engine with mock retrieval
import { generateRecommendations } from '@/lib/recommendation/engine';
// Mock fetchInternshipCandidates for unit tests
```

## Migration Notes

This refactor **preserves existing behavior**:
- ✅ Same scoring algorithm (0.4 TF-IDF + 0.6 BERT)
- ✅ Same filtering (0.1 threshold)
- ✅ Same ranking (top 20)
- ✅ Same database updates
- ✅ Backward compatible API

The only change is **architectural** - logic is now properly separated into modules.
