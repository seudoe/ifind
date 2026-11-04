import { redirect } from "next/navigation";
import { BrowseView } from "@/components/dashboard/BrowseView";
import { getSession } from "@/lib/auth";

type Params = Promise<{ username: string; slug: string }>;

/**
 * Internship detail page inside the student dashboard.
 *
 * Smart URL correction so shared / pasted links always land somewhere useful:
 * - Not signed in  →  /internships/[slug]  (public detail page, works for expired listings too)
 * - Signed in as a different user  →  /user/[real-username]/browse/[slug]
 * - Signed in as the right user  →  render the BrowseView with that internship pre-opened
 */
export default async function BrowseInternshipPage({ params }: { params: Params }) {
  const { username, slug } = await params;

  const session = await getSession().catch(() => null);

  if (!session) {
    // Not signed in – send to the public detail page (works for expired listings too)
    redirect(`/internships/${slug}`);
  }

  if (session.username !== username) {
    // Signed in as someone else – silently fix the URL to the real username
    redirect(`/user/${session.username}/browse/${slug}`);
  }

  return <BrowseView slug={slug} />;
}
