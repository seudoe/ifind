import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

const gone = () =>
  NextResponse.json({ success: false, error: "Your resume file is no longer stored. Please upload it again." }, { status: 404 });

/** ImageKit endpoint origin: the only place a stored resume link may point to (no open fetch of arbitrary URLs). */
function allowedOrigin(): string {
  try {
    return new URL(process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io").origin;
  } catch {
    return "https://ik.imagekit.io";
  }
}

async function load(req: NextRequest, head: boolean) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  await connectDB();
  const user = await User.findById(session.userId).select("resume").lean<{ resume?: { driveViewLink?: string | null; pendingViewLink?: string | null } }>();
  const wantPending = req.nextUrl.searchParams.get("pending") === "1";
  const link = wantPending ? user?.resume?.pendingViewLink : user?.resume?.driveViewLink;
  if (!link) return gone();

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return gone();
  }
  if (url.origin !== allowedOrigin()) return gone();

  const upstream = await fetch(url, { method: head ? "HEAD" : "GET", cache: "no-store" }).catch(() => null);
  if (!upstream || !upstream.ok) return gone();
  if (head) return new NextResponse(null, { status: 200 });

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

/** Streams the signed-in student's own resume PDF inline (same origin, so the preview iframe and "Open PDF" both work). */
export async function GET(req: NextRequest) {
  return load(req, false);
}

/** Cheap existence check used by the preview before it renders the iframe. */
export async function HEAD(req: NextRequest) {
  return load(req, true);
}
