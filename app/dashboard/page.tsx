import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Public pages and the footer link to /dashboard?tab=…; the real pages live under /user/[username]/…
const TAB_TO_PATH: Record<string, string> = {
  internships: "browse",
  overview: "overview",
  resume: "resume",
  saved: "saved",
  applied: "applied-internships",
  chat: "chat",
  career: "career",
};

export default async function DashboardRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/user/login");
  redirect(`/user/${session.username}/${TAB_TO_PATH[tab ?? ""] ?? "overview"}`);
}
