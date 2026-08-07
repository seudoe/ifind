import { redirect } from "next/navigation";
import { Shield, Clock } from "lucide-react";
import { getModSession } from "@/lib/moderatorAuth";

export default async function ModeratorPendingPage() {
    const session = await getModSession();

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
                    <h1 className="text-lg font-bold text-[var(--text)]">
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

                    <div className="border-t border-[var(--border)] pt-4">
                        <p className="text-xs text-[var(--text-3)] leading-relaxed">
                            Once verified, you can sign in again to access the
                            full moderator panel. If you believe this is taking
                            too long, please contact the platform administrator.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
