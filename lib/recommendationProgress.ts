/** Browser events that tie a profile / resume save to the "Updating recommendations" card and to the student data refresh. */
export const RECOMMENDATION_RUN = "ifind:recommendation-run";
export const RECOMMENDATIONS_UPDATED = "ifind:recommendations-updated";

/** Call after a save that may change the student's recommendations (the server decides whether a run actually starts). */
export function announceRecommendationRun(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECOMMENDATION_RUN));
}
