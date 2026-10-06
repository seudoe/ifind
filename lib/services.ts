/**
 * Base URLs of the other services, read from the environment on every call. Nothing is hardcoded: an unset
 * variable means "service not configured" and callers degrade (employer posts wait for a moderator, no
 * vectorisation) instead of calling a stale default.
 *
 *   INTERNSCRAPER_URL     internScraper (scraping + scam detection + /process)
 *   VECTORISER_URL        vectoriser (vectors, HNSW graph, student recommendations); VECTORIZER_URL still accepted
 *   RESUME_EXTRACTOR_URL  resume extractor (HF Space)
 */
const clean = (v?: string) => v?.trim().replace(/\/+$/, "") || undefined;

export const internscraperUrl = () => clean(process.env.INTERNSCRAPER_URL);
export const vectoriserUrl = () => clean(process.env.VECTORISER_URL ?? process.env.VECTORIZER_URL);
export const resumeExtractorUrl = () => clean(process.env.RESUME_EXTRACTOR_URL);
