export type ImageKind = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

/**
 * Identify an image from its leading bytes. The browser-supplied `file.type` and filename are
 * attacker-controlled, so they're never trusted: an "image/png" upload that is really HTML or SVG would
 * otherwise be stored and served back from our storage domain. Only these three raster formats pass.
 */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** PDFs start with %PDF- (spec allows a little leading junk, so look in the first KB). */
export function looksLikePdf(buf: Buffer): boolean {
  return buf.subarray(0, 1024).includes("%PDF-");
}
