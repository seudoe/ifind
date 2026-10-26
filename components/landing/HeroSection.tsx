import Image from "next/image";
import Link from "next/link";
import { MapPin, Search, Star, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroSearch } from "@/components/landing/HeroSearch";
import { StipendBadge } from "@/components/internships/StipendBadge";
import { formatAddresses } from "@/lib/address";
import { internshipSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { Internship } from "@/types";

const FEATURES = [
  { icon: Search, label: "Personalized matching" },
  { icon: Zap, label: "Startups & established companies" },
  { icon: User, label: "Build your profile once" },
  { icon: Star, label: "Kickstart your career" },
];

const POPULAR = ["React Developer", "Data Science", "UI/UX Design", "Marketing", "Finance", "Machine Learning"];

const ACCENTS = ["var(--accent-1)", "var(--accent-2)", "var(--accent-3)", "var(--accent-4)", "var(--accent-5)", "var(--accent-6)"];

interface Props {
  stats: { internships: number; students: number; companies: number; applications: number };
  categories: { label: string; code: string; count: number }[];
  latest?: Internship;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** Landing hero: copy + live latest listing on the left/right, then search, category chips and real platform numbers. */
export function HeroSection({ stats, categories, latest }: Props) {
  const location = latest
    ? latest.isRemote
      ? "Work from Home"
      : formatAddresses(latest.address, ["city", "state"]) || "India"
    : "";

  const STATS = [
    { value: stats.internships, label: "Active internships" },
    { value: stats.companies, label: "Hiring companies" },
    { value: stats.students, label: "Students on iFind" },
    { value: stats.applications, label: "Applications sent" },
  ];

  return (
    <section className="relative overflow-hidden border-b-2 border-[var(--rule)]" style={{ background: "var(--landing-grad)" }}>
      {/* Decorative spheres — colours come from the theme tokens */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-20 -left-24 w-80 h-80 rounded-full blur-[2px]" style={{ background: "radial-gradient(circle at 35% 35%, var(--sphere-violet), transparent 70%)" }} />
        <div className="absolute top-36 -right-36 w-[420px] h-[420px] rounded-full blur-[2px]" style={{ background: "radial-gradient(circle at 35% 35%, var(--sphere-blue), transparent 70%)" }} />
        <div className="absolute bottom-14 left-[6%] w-44 h-44 rounded-full blur-[2px]" style={{ background: "radial-gradient(circle at 35% 35%, var(--sphere-green), transparent 70%)" }} />
        <div className="absolute -bottom-28 right-[10%] w-64 h-64 rounded-full blur-[2px]" style={{ background: "radial-gradient(circle at 35% 35%, var(--sphere-navy), transparent 70%)" }} />
      </div>

      <div className="relative container-page">
        {/* ── Two-column hero ─────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center pt-12 pb-6 lg:pt-16">
          <div>
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--primary)] mb-3.5">From campus to career</p>
            <h1 className="text-4xl sm:text-[42px] font-extrabold leading-[1.18] text-[var(--heading)] mb-4">
              Your skills.<br />
              Real <span className="text-[var(--primary)]">opportunities.</span><br />
              A brighter future.
            </h1>
            <p className="text-[15px] leading-[1.7] text-[var(--text-2)] max-w-md mb-7">
              Upload your resume once and iFind matches you with internships that fit your skills, interests and goals — browse them freely, sign in only when you apply.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col gap-2 text-[11.5px] font-semibold leading-snug text-[var(--text)]">
                  <span className="h-10 w-10 rounded-[10px] bg-[var(--primary-bg)] text-[var(--primary)] flex items-center justify-center"><Icon className="h-4 w-4" /></span>
                  {label}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link href="/internships"><Button size="lg">Browse internships →</Button></Link>
              <Link href="/user/register"><Button size="lg" variant="secondary">Create account</Button></Link>
            </div>
          </div>

          {/* Visual: graduate photo on a brand panel, with the newest real listing floating over it */}
          <div className="relative w-full">
            <div className="relative aspect-[1444/1089] overflow-hidden rounded-[24px] shadow-[var(--shadow-lg)]" style={{ background: "linear-gradient(160deg, var(--primary) 0%, var(--navy) 100%)" }}>
              <Image src="/hero-student.png" alt="Smiling graduate holding a laptop in front of a company campus" fill priority sizes="(min-width: 1024px) 480px, 90vw" className="object-cover" />
            </div>
            {latest && (
              <Link
                href={`/internships/${internshipSlug(latest)}`}
                className="absolute -left-2 sm:-left-6 bottom-8 max-w-[260px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-lg)] hover:border-[var(--primary)] transition-colors"
              >
                <span className="label !text-[10px] !text-[var(--success)]">● Newly listed</span>
                <p className="text-[13px] font-bold leading-snug text-[var(--heading)] mt-1 line-clamp-2">{latest.name}</p>
                <p className="text-[11.5px] text-[var(--text-3)] truncate">{latest.company}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text)]">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>
                  <StipendBadge stipend={latest.stipend} className="text-[11px]" />
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* ── Search + chips ───────────────────────────────────────────────── */}
        <div className="text-center py-8">
          <HeroSearch />
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="label">Popular:</span>
            {POPULAR.map((term) => (
              <Link key={term} href={`/internships?q=${encodeURIComponent(term)}`} className="pill">{term}</Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            {categories.map((c, i) => (
              <Link
                key={c.label}
                href={`/internships?category=${encodeURIComponent(c.label)}`}
                className="inline-flex items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text)] hover:border-[var(--primary)] hover:shadow-[var(--shadow-violet)] transition-all"
              >
                <span className="h-[18px] w-[18px] rounded-[4px] text-white text-[8px] font-bold flex items-center justify-center" style={{ background: ACCENTS[i % ACCENTS.length] }}>{c.code}</span>
                {c.label}
                <span className={cn("font-mono text-[10.5px] text-[var(--text-3)]")}>{fmt(c.count)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Real platform numbers ───────────────────────────────────────── */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 border-t-2 border-[var(--rule)] pt-7 pb-10">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <dd className="text-[28px] font-extrabold text-[var(--heading)] leading-none">{fmt(s.value)}</dd>
              <dt className="text-[12px] text-[var(--text-2)] mt-1.5">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
