import Link from "next/link";
import { Briefcase, Search, Users, BarChart3, ArrowRight, CheckCircle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Footer } from "@/components/layout/Footer";

const FEATURES = [
  { icon: Search,    title: "Smart Candidate Matching",   desc: "Our AI matches your internship requirements with student profiles — skills, education, and experience." },
  { icon: Users,     title: "2M+ Student Database",       desc: "Access India's largest pool of verified student profiles across engineering, design, management and more." },
  { icon: BarChart3, title: "Application Dashboard",      desc: "Track every applicant in one place. Filter, shortlist, and reach out without leaving the platform." },
  { icon: CheckCircle, title: "Scam-Free Listings",       desc: "Every posting goes through our moderation pipeline so students trust your listings." },
];

const STEPS = [
  { num: "01", title: "Create your company profile",    desc: "Tell us about your company, size, and the kind of talent you're looking for." },
  { num: "02", title: "Post an internship",             desc: "Fill in role details, stipend, duration and required skills. Takes under 5 minutes." },
  { num: "03", title: "Review applications",           desc: "Browse matched candidates, shortlist the best, and start conversations — all in one dashboard." },
];

export default function EmployerLandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] plasma-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-[var(--text)]">
              i<span className="text-[var(--primary)]">Find</span>
              <span className="text-xs font-normal text-[var(--text-3)] ml-1.5">for Employers</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">Student portal</Button>
            </Link>
            <Link href="/employer/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
            <Link href="/employer/register">
              <Button variant="primary" size="sm">Post Internship</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="relative bg-[var(--surface)] border-b border-[var(--border)] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-[var(--primary-bg)] opacity-50 -translate-x-1/3 -translate-y-1/3" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-[var(--primary-bg)] border border-[var(--primary)]/20 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] mb-6">
                <GraduationCap className="h-3.5 w-3.5" />
                2M+ students ready to intern
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text)] leading-tight tracking-tight mb-5">
                Hire the best{" "}
                <span className="text-[var(--primary)]">student talent</span>
                {" "}in India
              </h1>
              <p className="text-base sm:text-lg text-[var(--text-2)] leading-relaxed mb-8 max-w-xl">
                Post internships on iFind and reach thousands of verified, skill-matched candidates —
                at zero cost for early-stage companies.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/employer/register">
                  <Button size="lg" className="gap-2 px-6">
                    Post an Internship <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/user">
                  <Button size="lg" variant="outline" className="gap-2">
                    Browse as Student
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[var(--text)]">Why employers choose iFind</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="plasma-card p-5">
                  <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] text-[var(--primary)] flex items-center justify-center mb-3">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text)] mb-1.5">{title}</h3>
                  <p className="text-xs text-[var(--text-2)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-14 bg-[var(--surface)] border-t border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <h2 className="text-xl font-bold text-[var(--text)]">Get started in 3 steps</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map(({ num, title, desc }) => (
                <div key={num} className="plasma-card p-6 text-center">
                  <div className="text-3xl font-black text-[var(--primary)] opacity-30 mb-3">{num}</div>
                  <h3 className="text-sm font-semibold text-[var(--text)] mb-2">{title}</h3>
                  <p className="text-xs text-[var(--text-2)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/employer/register">
                <Button size="lg" className="px-8 gap-2">
                  Start Posting Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Student portal CTA */}
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 plasma-card p-6">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Looking for an internship yourself?</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">Browse 50,000+ internships on the student portal.</p>
            </div>
            <Link href="/user">
              <Button variant="outline" size="sm" className="gap-2">
                <GraduationCap className="h-3.5 w-3.5" /> Go to Student Portal
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
