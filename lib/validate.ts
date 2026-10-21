import mongoose from "mongoose";

/**
 * True only for a real ObjectId. Use before putting a client-supplied id into a query:
 * it rejects objects such as `{ "$ne": "" }` and strings that merely look hex-ish.
 */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value) && mongoose.isValidObjectId(value);
}

/** Plain, length-capped string; anything else (objects, arrays, numbers) becomes undefined. */
export function str(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length <= max ? value.trim() : undefined;
}

/** Array of capped strings; undefined if the value is not such an array. */
export function strList(value: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > maxLen) return undefined;
    if (item.trim()) out.push(item.trim());
  }
  return out;
}
