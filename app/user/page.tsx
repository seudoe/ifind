import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PublicInternshipCard } from "@/components/internships/PublicInternshipCard";
import { CATEGORIES, getLandingData } from "@/lib/publicInternships";

const EMPTY = {
  stats: { internships: 0, students: 0, companies: 0, applications: 0 },
  topCompanies: [] as string[],
  categories: CATEGORIES.map((c) => ({ label: c.label, code: c.code, count: 0 })),
  featured: [],
};

export default async function StudentLandingPage() {
  // The page still renders if the database is unreachable; the numbers just read zero instead of failing the whole page
  const data = await getLandingData().catch(() => EMPTY);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <HeroSection stats={data.stats} categories={data.categories} latest={data.featured[0]} />

        {data.featured.length > 0 && (
          <section id="categories" className="py-12 bg-[var(--bg)]">
            <div className="container-page">
              <div className="flex items-end justify-between gap-4 pb-3 mb-6 border-b-2 border-[var(--rule)]">
                <div>
                  <h2 className="text-xl font-bold text-[var(--heading)]">Latest internships</h2>
                  <p className="text-[13px] text-[var(--text-3)] mt-0.5">Open it to read everything — you only sign in to apply.</p>
                </div>
                <Link href="/internships" className="pill shrink-0 flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.featured.map((i) => <PublicInternshipCard key={String(i._id)} internship={i} />)}
              </div>
            </div>
          </section>
        )}

        {data.topCompanies.length > 0 && (
          <section className="py-8 border-y border-[var(--border)] bg-[var(--surface)]">
            <div className="container-page text-center">
              <p className="label mb-4">Most listings from</p>
              <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
                {data.topCompanies.map((c) => (
                  <Link key={c} href={`/internships?q=${encodeURIComponent(c)}`} className="text-sm font-semibold text-[var(--text-2)] hover:text-[var(--primary)] transition-colors">{c}</Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <HowItWorks />

        <section className="py-10 bg-[var(--surface)] border-t-2 border-[var(--rule)]">
          <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[var(--heading)]">Are you an employer?</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">Post internships and find the right candidates.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="label">Other portals:</span>
              <Link href="/employer" className="pill flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Employer portal →</Link>
              <Link href="/moderator/login" className="pill">Moderator portal →</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
