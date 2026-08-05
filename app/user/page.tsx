import { Navbar }              from "@/components/layout/Navbar";
import { Footer }              from "@/components/layout/Footer";
import { HeroSection }         from "@/components/landing/HeroSection";
import { StatsBar }            from "@/components/landing/StatsBar";
import { TrustBar }            from "@/components/landing/TrustBar";
import { CategoriesSection }   from "@/components/landing/CategoriesSection";
import { FeaturedInternships } from "@/components/landing/FeaturedInternships";
import { HowItWorks }          from "@/components/landing/HowItWorks";
import { Testimonials }        from "@/components/landing/Testimonials";
import Link                    from "next/link";
import { Building2 }           from "lucide-react";

export default function StudentLandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsBar />
        <TrustBar />
        <CategoriesSection />
        <FeaturedInternships />
        <HowItWorks />
        <Testimonials />

        {/* Employer CTA strip */}
        <section className="py-10 bg-[var(--surface)] border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Are you an employer?</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">Post internships and find the right candidates.</p>
            </div>
            <Link
              href="/employer"
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-sm font-medium text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] transition-all duration-[var(--transition)]"
            >
              <Building2 className="h-4 w-4" />
              Go to Employer Portal
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
