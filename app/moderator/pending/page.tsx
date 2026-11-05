import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Shield, Clock } from "lucide-react";
import { getModSessionAny } from "@/lib/moderatorAuth";
import { isMobileUserAgent } from "@/lib/isSmallScreen";

export default async function ModeratorPendingPage() {
    const headerList = await headers();
    const ua = headerList.get("user-agent") || "";
    if (isMobileUserAgent(ua)) {
        redirect("/phone");
    }

    const session = await getModSessionAny();

    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-7">
                    <div className="inline-flex h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--primary)] items-center justify-center shadow-sm mb-3">
                        <Shield className="h-4.5 w-4.5 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-[var(--heading)]">
                        Account Pending
                    </h1>
                    <p className="text-sm text-[var(--text-3)] mt-1">
                        Welcome, {session.name}
                    </p>
                </div>

                <div className="plasma-card p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                            <Clock className="h-5 w-5 text-[var(--primary)]" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text)]">
                                Awaiting verification
                            </p>
                            <p className="text-sm text-[var(--text-3)] leading-relaxed">
                                Your moderator account is pending approval. An
                                existing verified moderator must verify your
                                account before you can access the panel.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
