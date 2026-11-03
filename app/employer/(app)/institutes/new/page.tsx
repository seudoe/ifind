import Link from "next/link";
import { Building2, GraduationCap } from "lucide-react";

export default function NewInstitutePage() {
    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-3xl">
            <Link href="/employer/institutes" className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">← Institutes</Link>
            <h1 className="text-lg font-bold text-[var(--heading)] mt-1 mb-1">What are you setting up?</h1>
            <p className="text-sm text-[var(--text-3)] mb-6">You can add both. They live side by side in your account.</p>
            <div className="grid gap-4 sm:grid-cols-2">
                <Link href="/employer/institutes/new/company" className="plasma-card p-5 block hover:shadow-[var(--shadow)] transition-shadow">
                    <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] flex items-center justify-center mb-3"><Building2 className="h-5 w-5 text-[var(--primary)]" /></div>
                    <p className="font-semibold text-[var(--text)]">Company</p>
                    <p className="text-sm text-[var(--text-3)] mt-1">Post internships that any student on iFind can apply to.</p>
                </Link>
                <Link href="/employer/institutes/new/campus" className="plasma-card p-5 block border-l-4 border-l-[var(--campus)] hover:shadow-[var(--shadow)] transition-shadow">
                    <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-[var(--campus-bg)] flex items-center justify-center mb-3"><GraduationCap className="h-5 w-5 text-[var(--campus)]" /></div>
                    <p className="font-semibold text-[var(--text)]">College campus</p>
                    <p className="text-sm text-[var(--text-3)] mt-1">Run on-campus internship drives for your own college&apos;s students.</p>
                </Link>
            </div>
        </main>
    );
}
