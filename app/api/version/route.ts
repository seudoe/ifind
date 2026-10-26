import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Which commit is deployed: set by the deploy workflow (GIT_SHA); INSTANCE names the Vercel account, Vercel's own metadata, or "dev" locally. */
export function GET() {
  const commit = process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json({ service: "ifind", commit: commit.slice(0, 7), instance: process.env.INSTANCE || "local", builtAt: process.env.BUILD_TIME || null });
}
