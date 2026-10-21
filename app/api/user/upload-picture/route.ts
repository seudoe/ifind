import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadResumeToImageKit } from "@/lib/imagekit";
import { sniffImage } from "@/lib/uploads";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const rl = await hit("upload", session.userId, RULES.uploadUser);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("picture")) as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }
    if (typeof file === "string" || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Image size must be under 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Judge the bytes, not the client-declared type or filename; extension comes from the detected format.
    const kind = sniffImage(buffer);
    if (!kind) {
      return NextResponse.json({ success: false, error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 });
    }
    const fileName = `${session.userId}_avatar_${Date.now()}.${kind.ext}`;

    const { url } = await uploadResumeToImageKit(buffer, fileName, "/avatars");

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (err) {
    console.error("[upload-picture POST]", err);
    return NextResponse.json(
      { success: false, error: "Photo upload failed" },
      { status: 500 }
    );
  }
}
