"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CampusInternshipForm } from "@/components/employer/CampusInternshipForm";
import { controlCls } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import type { CampusInternshipDTO } from "@/types/campus";

interface Props {
    entityId: string;
    suggestions: { courses: string[]; departments: string[]; batches: string[] };
}

interface Read {
    fields: Partial<CampusInternshipDTO>;
    confidence: Record<string, number>;
    missing: string[];
    sourceText: string;
}

const MAX = 12_000;

/** Step 1: paste the company's notification (optional). Step 2: the normal form, pre-filled for review. */
export function CampusInternshipStart({ entityId, suggestions }: Props) {
    const [phase, setPhase] = useState<"paste" | "form">("paste");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [read, setRead] = useState<Read | null>(null);

    const extract = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/employer/campus/${entityId}/internships/extract`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ text }),
            });
            const j = await res.json().catch(() => ({ success: false, error: "Something went wrong. Fill the form by hand." }));
            if (!j.success) {
                // Quota, outage, unreadable text: say so, keep the text, and let them continue by hand
                setError(j.error ?? "Could not read that text");
                return;
            }
            setRead(j.data);
            setPhase("form");
        } catch {
            setError("Network problem. Try again or fill the form by hand.");
        } finally {
            setBusy(false);
        }
    };

    if (phase === "form") {
        return (
            <CampusInternshipForm
                // A fresh form per reading, so suggestions replace the old state
                key={read?.sourceText.length ?? "manual"}
                entityId={entityId}
                title="Post a new internship"
                suggestions={suggestions}
                prefill={read?.fields}
                sourceText={read?.sourceText}
                review={read ? { confidence: read.confidence, missing: read.missing } : undefined}
            />
        );
    }

    return (
        <div className="max-w-3xl space-y-4">
            <h1 className="text-lg font-bold text-[var(--heading)]">Post a new internship</h1>
            <section className="plasma-card p-5 space-y-3 border-l-4 border-l-[var(--campus)]">
                <h2 className="font-semibold text-[var(--heading)] flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--campus)]" /> Paste the company&apos;s notification</h2>
                <p className="text-sm text-[var(--text-2)]">An email, a WhatsApp forward or an INF/JNF. We read the details into the form for you to check. Nothing is saved or published until you do it.</p>
                <textarea
                    rows={10}
                    className={controlCls}
                    value={text}
                    maxLength={MAX + 2000}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste here…"
                    aria-label="Company notification text"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-xs ${text.length > MAX ? "text-[var(--danger)]" : "text-[var(--text-3)]"}`}>{text.length.toLocaleString("en-IN")} / {MAX.toLocaleString("en-IN")}</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setPhase("form")}>Skip, fill by hand</Button>
                        <Button type="button" loading={busy} disabled={text.trim().length < 20 || text.length > MAX} onClick={extract}>Read details</Button>
                    </div>
                </div>
                {error && <div role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error} <button type="button" className="underline" onClick={() => setPhase("form")}>Fill the form by hand</button></div>}
            </section>
        </div>
    );
}
