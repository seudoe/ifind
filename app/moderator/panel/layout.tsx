import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { connectDB } from "@/lib/db";
import Moderator from "@/models/Moderator";

export default async function ModeratorPanelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Validate moderator session — middleware already handles most cases,
    // but we double-check here so the layout is self-sufficient.
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    // Fetch the full moderator document to confirm the account still exists
    // (e.g. hasn't been deleted between token issuance and this request).
    await connectDB();
    const moderator = await Moderator.findById(session.moderatorId)
        .select("-password")
        .lean();

    if (!moderator) {
        redirect("/moderator/login");
    }

    // Each child page renders its own ModeratorShell with the correct activeTab.
    // The layout only acts as an auth guard — it does not wrap children in a
    // shell itself because layout.tsx cannot know the current pathname reliably
    // (layouts are cached across navigations and do not re-render).
    return <>{children}</>;
}
