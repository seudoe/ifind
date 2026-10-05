# Moderation → Vectorization → Recommendation Pipeline Fix

Date: 2026-10-05

## 1. Intended flow

```
internScraper (HF Space)
  scrape → validate + dedup → scam_detector → INSERT into  internships.mod-unvectorised   (staging)
                                                    │
        ┌───────────────────────────────────────────┤
        │ decision = clear  → moderation.status = auto_approved   ─┐
        │ decision = review → pending_review  (waits for moderator)│
        │ decision = block  → auto_rejected   (waits / stays)      │
        ▼                                                          │
ifind moderator panel reads STAGING                                │
  approve → manually_approved ─────────────────────────────────────┤
  reject  → manually_rejected (stays in staging)                   │
                                                                   ▼
vectorisationResume (HF Space)  POST /vectorize-hnsw   (approved statuses ONLY)
  encode (BERT 768-d + TF-IDF 15000-d) → insert node into HNSW graph
  → move doc to  internships  → delete from staging → persist graph to  internships.graph
                                                                   │
                                                                   ▼
ifind: add the new internship to every matching student's recommendations
```

Collection name (verified in the live DB): `internships.mod-unvectorised` (with an **s**). Other collections: `internships`, `internships.graph`, `users`, `moderators`, `employers`, `analyses`, `chatsessions`, `index`.

## 2. What was actually wrong (findings)

| # | Problem | Evidence |
|---|---------|----------|
| 1 | Moderator panel read/wrote `internships`, not staging | `models/Internship.ts` is `mongoose.model("Internship", schema)` with no collection override → collection `internships`. Present since the first moderator commit `c68a16e` (sam_wlh_ds, 2026-08-07). `git log -S"mod-unvectorised"` finds the string only in docs. No commit ever read staging in code. |
| 2 | Staging was dead storage | Collection had 0 docs; all 624 listings were in `internships`, all vectorized, all `isActive`. |
| 3 | Unapproved listings were live and recommended | 470 `pending_review`, 5 `auto_rejected`, 2 `manually_rejected` sat in `internships` and in the graph. 5 of 340 stored student recommendations pointed at them. |
| 4 | Vectorizer had no moderation filter | `vectorizer_hnsw_pipeline.py` processed *every* staged doc. |
| 5 | No real HNSW anywhere | Live `internships.graph` doc was a pickle of the pure-Python `FallbackHNSWIndex` (a dict of vectors, no graph, no search method) because `hnswlib` was never installed. ifind's TypeScript `HNSWIndexManager` looked for a different doc (`_id: "hnsw_index"`, JSON format) that doesn't exist, then rebuilt an in-memory `Map` and brute-forced every query. |
| 6 | Approve called a non-existent endpoint | `lib/internship-vectorizer.ts` POSTed to `/encode-internship` (singular). The vectorizer only exposes `/encode-internships`, `/encode-resume`, `/vectorize-hnsw`. Approval-time vectorization failed silently. |
| 7 | Vectorizer deployment was incomplete | `requirements.txt` lacked `pymongo`, `python-dotenv`, `hnswlib`; `Dockerfile` never copied `vectorizer_hnsw_pipeline.py` → `/vectorize-hnsw` would crash on import. |
| 8 | Hard-coded Mongo credential | URI with username/password was the fallback in `vectorizer_hnsw_pipeline.py` (same one previously in `scam_detector/run_on_db.py`). **Rotate the password.** |
| 9 | Staging and live shared one schema; detector fields leaked | All 624 live docs carried loose top-level `scam_score`, `decision`, `confidence`, `explanation_summary`, etc. |
| 10 | Scraper dedup only checked staging | Once approved docs leave staging, they would be re-scraped and re-scored every run. |
| 11 | Scraper failure mode fail-open | If `scam_detector` failed to import/run, every posting got score 0 → `auto_approved`. (Fixed earlier; see §6.) |

### Who introduced what

- `c68a16e` — **sam_wlh_ds**, 2026-08-07: moderator panel + model, bound to `internships`; docs (`context.md`) describe staging but code never used it.
- `a6917e0` — **SkanxGladiatorr07**, 2026-09-18: vectorize-on-approve + `tfidf_vector`/`bert_vector` on the model, built on top of the wrong collection.
- Scraper staging write: `internScraper` `34ee732` — **seudoe**, 2026-08-07 (correct; the two halves were built in parallel and never connected).
- No commit by seudoe touched the moderator internships routes or model.

## 3. Design decisions (confirmed with the user)

- Which app: `ifind` (not `ifind-Next`).
- Vectorizing and graph ownership: the **Python HF service** (it has the models and the staging→live move). `ifind` only triggers it.
- Recommendations: keep **one HNSW over internships**, queried with a student's vector; when a new internship is published it is scored against each student's resume vector and merged into qualifying lists (O(students), not O(students × internships)). A second index over students was rejected as unnecessary at current scale.
- Existing data: move non-approved listings back to staging (migration script, dry-run first, backup first).

## 4. Schemas

### Staging — `internships.mod-unvectorised` (`StagedInternship`)
Listing fields (`name, company, applyLink, datePublished, deadlineDate, country/state/city, isRemote, stipend, duration, skills, degree, field, experienceRequired, openings, summary, responsibilities, perks, tags, source, isActive, fingerprint, linkVerification`) + `moderation` (`status, score, flags, source, reviewedBy, reviewedAt, rejectionReason, scamDetails{score, decision, confidence, explanationSummary, scamFlags, evaluatedAt, riskBreakdown}`).
**No** `tfidf_vector`/`bert_vector`; **no** loose detector fields. Mongoose strict mode drops vectors if anything tries to write them.

### Live — `internships` (`Internship`)
Same listing + `moderation`, **plus** `tfidf_vector` (15000-d) and `bert_vector` (768-d), written by the vectorizer at move time. Loose detector fields are stripped.

Both models live in `models/Internship.ts` and share one `listingFields` definition; only the vector fields and the bound collection differ. `STAGING_COLLECTION` is exported.

## 5. Moderation status → location

| status | where it lives | next step |
|--------|---------------|-----------|
| `auto_approved` | staging until the vectorizer runs, then `internships` | vectorize, graph, move |
| `manually_approved` | same | same |
| `pending_review` | staging | moderator decides |
| `auto_rejected` | staging | moderator may still approve |
| `manually_rejected` | staging | stays |

The moderator list endpoint reads staging for pending/rejected statuses and the live collection for the two approved statuses (approved docs leave staging).

## 6. Changes by repo

### `internScraper`
- `scam_detector/` — replaced the older deployed copy with the current detector (merge conflict in `pipeline.py` resolved by keeping both the `moderation` object and the richer fields).
- `pipeline.py`
  - detector failure now **fails closed**: all postings routed to `pending_review` (score 50, confidence 0) instead of auto-approved;
  - missing `decision` defaults to `review`, not `clear`;
  - `riskBreakdown.anomalyScore` is filled;
  - dedup checks staging **and** live `internships`;
  - `_DETECTOR_EXTRA_KEYS` popped from the doc before insert (staging schema).
- `script.py` — after pushing, if `VECTORIZER_URL` is set, POSTs `{"background": true}` to `/vectorize-hnsw`.
- `requirements.txt` — added the detector's runtime deps (pydantic, numpy, pandas, scikit-learn, rapidfuzz, tldextract, networkx, python-Levenshtein, python-whois). Before this the detector's imports would fail on HF and (with the old fail-open fallback) everything would be auto-approved.

### `tf-idfs+berts/vectorisationResume` (vectorizer HF Space)
- `vectorizer_hnsw_pipeline.py` (rewritten)
  - only `auto_approved` / `manually_approved` staged docs are processed; optional `ids` restricts the run; non-approved docs are never touched;
  - one graph persist per run (was per document), runs serialized by `PIPELINE_LOCK`;
  - move = upsert into `internships`, then delete from staging; a failed doc stays in staging and is retried;
  - graph doc records `impl` (`native` / `fallback`); on mismatch (e.g. old pickle vs. native hnswlib) the graph is rebuilt from live vectors;
  - `HNSWIndexManager.search`, `rebuild_from_db`, module-level `search_graph` (reloads when `internships.graph.updatedAt` changes);
  - `FallbackHNSWIndex` gained `knn_query` (brute force, marked with a `ponytail:` ceiling comment: fine under ~10k vectors; real HNSW needs hnswlib);
  - hard-coded Mongo URI removed; `MONGODB_URI` required.
- `app.py` — `POST /vectorize-hnsw` takes `{ids?, background?}`; new `POST /search-internships {vector,k}`; new `POST /rebuild-graph`.
- `requirements.txt` — `pymongo`, `python-dotenv`, `hnswlib`. `Dockerfile` — `build-essential` (hnswlib compiles C++) and `COPY vectorizer_hnsw_pipeline.py`.
- `migrate_unapproved_to_staging.py` — one-off cleanup (see §8).

### `ifind`
- `models/Internship.ts` — two models/schemas (§4).
- `app/api/moderator/internships/route.ts` — reads staging (live for approved statuses); search string is regex-escaped.
- `app/api/moderator/internships/[id]/route.ts` — operates on staging; approve → `manually_approved` → `publishApprovedInternships([id])` → returns `{success, published}`; reject → `manually_rejected` (stays in staging); 409 if the id is already published.
- `components/moderator/InternshipsPanel.tsx` — "Manually Rejected" tab; warning toast if approved but indexing is pending.
- `lib/internship-vectorizer.ts` — rewritten: triggers the HF service, then updates recommendations; `rebuildInternshipIndex` → `/rebuild-graph`; `deactivateInternship` sets `isActive=false` (search filters on it).
- `lib/recommendation/onNewInternship.ts` (new) — `addInternshipToRecommendations(id)`: one weighted dot-product per student (0.4 TF-IDF + 0.6 BERT, threshold 0.1, top 20), merges into `recommendedInternships.recommendedList/recommendedScores`, invalidates that student's cache entry.
- `lib/recommendation/strategies/HNSWStrategy.ts` — queries the graph via `/search-internships`; filters `isActive`; falls back to brute force if the graph is unreachable.

## 7. Verification done

- `tsc --noEmit` on `ifind`: no new errors (one unrelated pre-existing error in `lib/ai/aiService.ts`).
- Python modules compile; offline test of the graph manager: search returns the exact match first (similarity 1.0), `k` larger than the index is clamped, fallback serialization round-trips.
- Read-only dry run of the migration against the live DB (below).
- Not verified: an end-to-end run against the deployed HF services, native hnswlib behavior (not installed locally), and the full `scam_detector` test suite after the final edits to `internScraper/pipeline.py` (before them: 659 passed, 2 failed only because `shap`/`rapidfuzz` weren't installed locally).

## 8. Existing-data migration

`python migrate_unapproved_to_staging.py` (dry run) / `--apply`.

Dry-run result on the live DB:

| | count |
|---|---|
| live `internships` | 624 |
| approved (stay live) | 147 |
| not approved → move to staging | 477 (470 `pending_review`, 5 `auto_rejected`, 2 `manually_rejected`) |
| already in staging | 0 |
| students with these in recommendations | 4 |
| live docs with stray detector fields | 624 |

`--apply` does, in order: backup affected docs to `backup_unapproved_<ts>.json` and copy the graph doc to `internships.graph.bak`; upsert movers into staging in the staging schema; delete them from live only after all inserts; `$pull` them from students' `recommendedInternships`; `$unset` stray fields on remaining live docs; clear `recommendation_cache`; rebuild the graph from the 147 remaining vectors.
**Status: not yet applied** — waiting for explicit go-ahead.

## 9. Deployment checklist

1. Redeploy `vectorisationResume` (builds hnswlib).
2. Redeploy `internScraper` (new deps + `script.py` trigger).
3. Set `VECTORIZER_URL` as a secret on the scraper Space; ifind reads the same variable.
4. **Rotate the Mongo password** that was hard-coded in the vectorizer (and previously in `scam_detector/run_on_db.py`).
5. Remove `internScraper/scam_detector/.env.local` from git if tracked (contains secrets).
6. Run the migration with `--apply` after the vectorizer is redeployed.

## 10. Known gaps / follow-ups

- Vectorizer endpoints are unauthenticated (as before); add an API key header.
- Scraper triggers the vectorizer fire-and-forget; if the call is lost, `auto_approved` docs wait until the next trigger. A periodic call to `/vectorize-hnsw` would remove that dependency.
- Students' saved/applied lists are not cleaned for moved listings (only recommendations are).
- `lib/hnsw/HNSWIndexManager.ts`, `lib/recommendation/monitoring.ts` and the `test-*.ts` scripts still reference the old in-memory TypeScript index; now unused by the recommender and safe to delete.
- Uncommitted changes in `ifind` by a teammate (`lib/vectorizer.ts`, `types/resume.ts`, profile page, `upload-temp`) were not touched.
- `ifind-Next` (separate repo, its own `admin/moderation` + `admin/vectorize` routes) was not changed.
