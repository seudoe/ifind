import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadResumeToImageKit } from "@/lib/imagekit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("picture")) as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Only image files (JPG, PNG, WebP) are allowed" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Image size must be under 5MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${session.userId}_avatar_${Date.now()}.${ext}`;

    const { url } = await uploadResumeToImageKit(buffer, fileName, "/avatars");

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (err) {
    console.error("[upload-picture POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Photo upload failed" },
      { status: 500 }
    );
  }
}
