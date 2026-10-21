import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/employer/upload";
import { uploadResumeToImageKit } from "@/lib/imagekit";
import { sniffImage } from "@/lib/uploads";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Company logo / cover upload (ImageKit). Returns { url }; the caller stores it on the company. */
export async function POST(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const rl = await hit("upload", String(employer._id), RULES.uploadUser);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const file = (await request.formData()).get("file") as File | null;
        if (!file) return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
        if (!IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 });
        }
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ success: false, error: "Image must be under 2MB" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const kind = sniffImage(buffer); // declared type above is only a first filter; the bytes decide
        if (!kind) return NextResponse.json({ success: false, error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 });
        const { url } = await uploadResumeToImageKit(buffer, `${String(employer._id)}_${Date.now()}.${kind.ext}`, "/company-images");
        return NextResponse.json({ success: true, data: { url } });
    } catch (error) {
        console.error("[employer/uploads]", error);
        return NextResponse.json({ success: false, error: "Image upload failed" }, { status: 500 });
    }
}
