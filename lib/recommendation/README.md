# Recommendation Engine

A modular, scalable recommendation service for generating personalized internship recommendations with **pluggable retrieval strategies**.

## Architecture Overview

The recommendation engine uses the **Strategy Pattern** to support interchangeable retrieval algorithms, making it easy to switch between brute-force and HNSW-based retrieval without affecting the rest of the application.

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
│  Strategy Layer  │              │   Scoring Layer         │
│  (strategies/)   │              │   (scoring.ts)          │
│                  │              │                         │
│  • Factory       │              │  • Vector similarity    │
│  • BruteForce    │              │  • Score computation    │
│  • HNSW (stub)   │              │  • Dot product          │
└──────────────────┘              └─────────────────────────┘
```

## Module Breakdown

### Core Modules

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

### 3. **engine.ts** - Recommendation Generation
Core recommendation pipeline orchestration:
- `generateRecommendations()` - Main entry point
  1. Retrieve candidates (via strategy)
  2. Score each candidate
  3. Filter by threshold
  4. Sort by score
  5. Return top N
- Now accepts optional `RecommendationStrategy` parameter

### 4. **index.ts** - Public API
Main service interface:
- `generateAndSaveRecommendations()` - Generate and persist recommendations
- Accepts optional strategy parameter for custom retrieval

### Strategy Pattern (New in Phase 2)

### 5. **strategies/** - Pluggable Retrieval Strategies

#### **strategies/types.ts** - Strategy Interfaces
- `RecommendationStrategy` - Abstract interface all strategies must implement
- `StrategyContext` - Context passed to retrieval strategies
- `StrategyType` - Enum of supported strategy types

#### **strategies/BruteForceStrategy.ts** - Default Strategy
Current implementation that loads all active internships:
- Simple and straightforward
- Always returns exact results
- O(n) complexity where n = total internships
- **This is the active default strategy**

#### **strategies/HNSWStrategy.ts** - Future Strategy (Placeholder)
Placeholder for HNSW approximate nearest neighbor search:
- Not yet implemented (throws error if used)
- Will provide sublinear query time
- Structure ready for future implementation

#### **strategies/StrategyFactory.ts** - Strategy Management
Centralized factory for creating and managing strategies:
- Singleton pattern for global strategy instance
- Environment-based configuration (`RECOMMENDATION_STRATEGY` env var)
- Automatic fallback to brute-force on errors
- `getDefaultStrategy()` - Convenience function to get active strategy

## Usage

### Basic Usage (Default Strategy)

```typescript
import { generateAndSaveRecommendations } from '@/lib/recommendation';

// Generate recommendations using the default strategy (brute-force)
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

### With Custom Strategy (Advanced)

```typescript
import { 
  generateAndSaveRecommendations,
  BruteForceStrategy,
} from '@/lib/recommendation';

// Create a custom strategy instance
const strategy = new BruteForceStrategy();
await strategy.initialize?.();

// Use custom strategy
const success = await generateAndSaveRecommendations(
  userId,
  userVectors,
  undefined, // Use default config
  strategy   // Custom strategy
);
```

### Strategy Configuration via Environment

Set the `RECOMMENDATION_STRATEGY` environment variable:

```bash
# Use brute-force (default)
RECOMMENDATION_STRATEGY=brute-force

# Use HNSW (when implemented)
RECOMMENDATION_STRATEGY=hnsw
```

### Factory Pattern Usage

```typescript
import { StrategyFactory, StrategyType } from '@/lib/recommendation';

// Get factory instance
const factory = StrategyFactory.getInstance();

// Get current strategy
const strategy = await factory.getStrategy();

// Change strategy at runtime
await factory.setConfig({ type: StrategyType.BRUTE_FORCE });

// Get new strategy
const newStrategy = await factory.getStrategy();
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

- **Retrieval**: Brute-force via `BruteForceStrategy` (loads all active internships)
- **Scoring**: Weighted combination of TF-IDF (40%) and BERT (60%) similarities
- **Filtering**: Removes candidates below 0.1 threshold
- **Ranking**: Sorts by score descending
- **Output**: Top 20 recommendations
- **Strategy**: Configurable via `RECOMMENDATION_STRATEGY` environment variable

## Strategy Pattern Benefits

### Flexibility
- Swap retrieval algorithms without changing application code
- Test different strategies easily
- Support multiple strategies simultaneously

### Maintainability
- Each strategy is independently testable
- Clear separation between retrieval and scoring
- Easy to understand and modify

### Extensibility
- Add new strategies by implementing `RecommendationStrategy` interface
- Factory handles strategy creation and lifecycle
- Strategies can have their own configuration

### Performance
- HNSW strategy (when implemented) will provide O(log n) retrieval
- Strategies can be optimized independently
- Easy to benchmark different approaches

## Future Enhancements

This architecture is designed to support:

1. **HNSW Integration** (Phase 3)
   - Implement `HNSWStrategy.retrieveCandidates()`
   - Load HNSW graph from `internships.graph` collection
   - Perform approximate k-NN search
   - Achieve O(log n) query time

2. **Hybrid Strategies**
   - Combine HNSW pre-filtering with brute-force refinement
   - Use HNSW for initial candidate selection, then full scoring
   - Implement `HybridStrategy` class

3. **Caching Layer**
   - Add Redis/in-memory cache for frequent queries
   - Cache strategy results per user
   - Implement cache invalidation on new internships

4. **A/B Testing Framework**
   - Support multiple strategies running simultaneously
   - Compare strategy performance metrics
   - Gradual rollout of new strategies

5. **Strategy-Specific Optimizations**
   - HNSW: Index rebuilding, parameter tuning
   - BruteForce: Query optimization, connection pooling
   - Each strategy can optimize independently

6. **Explainability**
   - Add detailed scoring breakdowns per strategy
   - Strategy-specific confidence metrics
   - Reasoning for candidate selection

7. **Personalization**
   - User preference-aware strategies
   - Historical interaction weighting
   - Location-based filtering in strategies

## Testing

The modular design with strategy pattern makes testing straightforward:

### Unit Testing Strategies

```typescript
import { BruteForceStrategy } from '@/lib/recommendation/strategies';

describe('BruteForceStrategy', () => {
  it('should retrieve all active internships', async () => {
    const strategy = new BruteForceStrategy();
    const candidates = await strategy.retrieveCandidates({
      userVectors: mockVectors,
    });
    expect(candidates.length).toBeGreaterThan(0);
  });
});
```

### Testing Engine with Mock Strategy

```typescript
import { generateRecommendations } from '@/lib/recommendation/engine';
import type { RecommendationStrategy } from '@/lib/recommendation/strategies';

// Create mock strategy
const mockStrategy: RecommendationStrategy = {
  name: 'mock',
  async retrieveCandidates() {
    return mockCandidates;
  },
};

// Test engine with mock
const result = await generateRecommendations(
  { userVectors: mockVectors },
  mockStrategy
);
```

### Testing Strategy Factory

```typescript
import { StrategyFactory, StrategyType } from '@/lib/recommendation';

describe('StrategyFactory', () => {
  afterEach(() => {
    StrategyFactory.reset();
  });

  it('should return brute-force by default', async () => {
    const factory = StrategyFactory.getInstance();
    const strategy = await factory.getStrategy();
    expect(strategy.name).toBe('brute-force');
  });

  it('should switch strategies', async () => {
    const factory = StrategyFactory.getInstance();
    await factory.setConfig({ type: StrategyType.BRUTE_FORCE });
    const strategy = await factory.getStrategy();
    expect(strategy.name).toBe('brute-force');
  });
});
```

### Integration Testing

```typescript
// Test scoring independently
import { computeSimilarityScore } from '@/lib/recommendation/scoring';

const score = computeSimilarityScore(
  userTfidf, userBert,
  internshipTfidf, internshipBert
);

// Test full pipeline
import { generateAndSaveRecommendations } from '@/lib/recommendation';

const success = await generateAndSaveRecommendations(
  testUserId,
  testVectors
);
```

## Migration Notes

### Phase 1 → Phase 2 Changes

**What Changed:**
- ✅ Added strategy pattern for pluggable retrieval
- ✅ Created `BruteForceStrategy` (existing behavior)
- ✅ Created `HNSWStrategy` placeholder
- ✅ Added `StrategyFactory` for centralized management
- ✅ Updated `engine.ts` to accept strategy parameter
- ✅ Updated `index.ts` to support strategy injection

**What Stayed the Same:**
- ✅ Same scoring algorithm (0.4 TF-IDF + 0.6 BERT)
- ✅ Same filtering (0.1 threshold)
- ✅ Same ranking (top 20)
- ✅ Same database updates
- ✅ Same API signatures (backward compatible with optional params)
- ✅ Default behavior unchanged (uses `BruteForceStrategy`)

**Backward Compatibility:**
```typescript
// Old code still works (Phase 1)
await generateAndSaveRecommendations(userId, vectors);

// New capabilities available (Phase 2)
await generateAndSaveRecommendations(userId, vectors, config, strategy);
```

The strategy pattern is **fully backward compatible** - existing code works without modification.
