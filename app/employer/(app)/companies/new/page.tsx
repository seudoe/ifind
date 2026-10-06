"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanyForm } from "@/components/employer/CompanyForm";
import type { CompanyInput } from "@/lib/employer/validation";

export default function NewCompanyPage() {
    const router = useRouter();

    const onSubmit = async (data: CompanyInput) => {
        try {
            const res = await fetch("/api/employer/companies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data),
            });
            const j = await res.json();
            if (!j.success) return j.error as string;
            router.push(`/employer/company/${j.data._id}/overview`);
            return null;
        } catch {
            return "Unable to register company";
        }
    };

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-2xl">
            <Link href="/employer/companies" className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">← Companies</Link>
            <h1 className="text-lg font-bold text-[var(--text)] mt-1 mb-6">Register a company</h1>
            <CompanyForm mode="create" onSubmit={onSubmit} />
        </main>
    );
}
