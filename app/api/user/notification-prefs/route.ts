import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

/** Email preferences a student can change. Security, account and approval emails are not optional and are not listed. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  await connectDB();
  const user = await User.findById(session.userId).select("emailApplicationUpdates").lean<{ emailApplicationUpdates?: boolean }>();
  return NextResponse.json({ success: true, data: { applicationUpdates: user?.emailApplicationUpdates !== false } });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.applicationUpdates !== "boolean") {
    return NextResponse.json({ success: false, error: "applicationUpdates must be true or false" }, { status: 400 });
  }
  await connectDB();
  await User.updateOne({ _id: session.userId }, { $set: { emailApplicationUpdates: body.applicationUpdates } });
  return NextResponse.json({ success: true, data: { applicationUpdates: body.applicationUpdates } });
}
