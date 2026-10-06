export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Company logo/cover must be an ImageKit URL (i.e. came from our upload route). */
export function checkImageUrls(input: { logo?: string; coverImage?: string }): string | null {
    const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || process.env.IMAGEKIT_URL_ENDPOINT;
    if (!endpoint) return null; // ponytail: no endpoint configured -> can't verify, accept any http(s) URL
    for (const [field, url] of [["logo", input.logo], ["coverImage", input.coverImage]] as const) {
        if (url && !url.startsWith(endpoint)) return `${field} must be uploaded through iFind`;
    }
    return null;
}
