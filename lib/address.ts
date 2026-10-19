import type { Address } from "@/types/internship";

type MaybeAddresses = Address[] | null | undefined;

/** "Pune, Maharashtra, India" for one address; empty parts are skipped. */
export const formatAddress = (a: Address, parts: (keyof Address)[] = ["city", "state", "country"]): string =>
  parts.map((p) => a[p]).filter(Boolean).join(", ");

/** All addresses as one line, e.g. "Pune, Maharashtra · Bangalore, Karnataka". Empty string when there are none. */
export const formatAddresses = (addresses: MaybeAddresses, parts?: (keyof Address)[]): string =>
  (addresses ?? []).map((a) => formatAddress(a, parts)).filter(Boolean).join(" · ");

/** Every non-empty city/state/country, for text search and location filters. */
export const addressTerms = (addresses: MaybeAddresses): string[] =>
  (addresses ?? []).flatMap((a) => [a.city, a.state, a.country]).filter((v): v is string => !!v);

/** City of the first address: the part of the dedup fingerprint (internScraper/pipeline.py generate_fingerprint). */
export const primaryCity = (addresses: MaybeAddresses): string | null => addresses?.[0]?.city || null;
