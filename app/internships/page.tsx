import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublicInternshipCard } from "@/components/internships/PublicInternshipCard";
import { CATEGORIES, listPublicInternships } from "@/lib/publicInternships";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Browse internships — iFind",
  description: "Search live internships from across India. No account needed to look; sign in to apply.",
};

type SearchParams = Promise<{ q?: string; location?: string; category?: string; page?: string }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PublicInternshipsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q).slice(0, 80);
  const location = first(sp.location).slice(0, 60);
  const category = first(sp.category);
  const page = Math.max(parseInt(first(sp.page), 10) || 1, 1);

  const { items, total, pageSize } = await listPublicInternships({ q, location, category, page, pageSize: 12 }).catch(() => ({ items: [], total: 0, pageSize: 12 }));
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, location, category, page, ...over })) if (v && !(k === "page" && Number(v) === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/internships${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-page py-8">
      <div className="page-header" style={{ position: "static" }}>
        <h1 className="path !m-0">Internships</h1>
        <span className="status">● {total.toLocaleString("en-IN")} open now</span>
      </div>

      <form action="/internships" className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto] mb-4">
        <input name="q" defaultValue={q} placeholder="Role, skill, or company..." className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--primary)]" />
        <input name="location" defaultValue={location} placeholder="City or Work from Home" className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--primary)]" />
        {category && <input type="hidden" name="category" value={category} />}
        <Button type="submit" size="lg"><Search className="h-3.5 w-3.5" /> Search</Button>
      </form>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href={href({ category: "", page: 1 })} className={cn("pill", !category && "!bg-[var(--primary)] !text-white !border-[var(--primary)]")}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.label} href={href({ category: c.label, page: 1 })} className={cn("pill", category === c.label && "!bg-[var(--primary)] !text-white !border-[var(--primary)]")}>{c.label}</Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="plasma-card p-12 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--text-2)]">No internships match that search.</p>
          <Link href="/internships" className="text-xs text-[var(--primary)] hover:underline">Clear search</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((i) => <PublicInternshipCard key={String(i._id)} internship={i} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-[var(--border)]">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="pill">← Previous</Link> : <span />}
          <span className="label">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="pill">Next →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
