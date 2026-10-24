import { NextResponse } from "next/server";
import { getPublicInternship } from "@/lib/publicInternships";

export const runtime = "nodejs";

/** Public, read-only: one internship that any visitor may see (same visibility as the student feed). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const internship = await getPublicInternship(id);
    if (!internship) return NextResponse.json({ success: false, error: "Internship not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: internship });
  } catch (error) {
    console.error("[internships/get]", error);
    return NextResponse.json({ success: false, error: "Unable to load internship" }, { status: 500 });
  }
}
