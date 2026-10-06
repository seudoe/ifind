import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/employer/upload";
import { uploadResumeToImageKit } from "@/lib/imagekit";

export const runtime = "nodejs";

/** Company logo / cover upload (ImageKit). Returns { url }; the caller stores it on the company. */
export async function POST(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const file = (await request.formData()).get("file") as File | null;
        if (!file) return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
        if (!IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 });
        }
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ success: false, error: "Image must be under 2MB" }, { status: 400 });
        }

        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const { url } = await uploadResumeToImageKit(Buffer.from(await file.arrayBuffer()), `${String(employer._id)}_${Date.now()}.${ext}`, "/company-images");
        return NextResponse.json({ success: true, data: { url } });
    } catch (error) {
        console.error("[employer/uploads]", error);
        return NextResponse.json({ success: false, error: "Image upload failed" }, { status: 500 });
    }
}
