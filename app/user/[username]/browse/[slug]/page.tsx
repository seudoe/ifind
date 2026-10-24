import { BrowseView } from "@/components/dashboard/BrowseView";

export default async function BrowseInternshipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BrowseView slug={slug} />;
}
