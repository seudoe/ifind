import { redirect } from "next/navigation";

export default async function ModeratorPanelPage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;
    redirect(`/moderator/${username}/internships`);
}
