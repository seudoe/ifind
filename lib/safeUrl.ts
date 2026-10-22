/**
 * Links that come from scraped listings, parsed resumes or user input can be `javascript:` or `data:` URLs. React
 * 19 does not reliably stop those in `href`, and `window.open(url)` never goes through React at all. Anything that
 * becomes a link or is opened must pass through here first.
 */
export function safeHref(value: unknown, opts: { mailto?: boolean } = {}): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    if (opts.mailto && url.protocol === "mailto:") return url.href;
  } catch {
    /* not an absolute URL */
  }
  return undefined;
}
