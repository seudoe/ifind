/** Shareable internship URL segment: "<title>-<company>-<24-hex id>". Only the trailing id is used to look it up. */
export function internshipSlug(i: { name?: string | null; company?: string | null; _id: unknown }): string {
  const id = String(i._id);
  const words = `${i.name ?? ""} ${i.company ?? ""}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return words ? `${words}-${id}` : id;
}

/** The internship id inside a slug (or a bare id), or null if the slug carries none. */
export function idFromSlug(slug: string): string | null {
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* keep the raw value */ }
  return /(?:^|-)([0-9a-f]{24})$/i.exec(decoded)?.[1] ?? null;
}
