import { redirect } from "next/navigation";

export default function ModeratorPanelPage({
    params,
}: {
    params: { username: string };
}) {
    redirect(`/moderator/${params.username}/internships`);
}
