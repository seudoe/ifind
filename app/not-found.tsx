import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase, Compass, GraduationCap, Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for doesn't exist or has moved.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/user", label: "Student portal", hint: "Find internships matched to your resume", icon: GraduationCap },
  { href: "/employer", label: "For employers", hint: "Post internships and review candidates", icon: Building2 },
  { href: "/user/login", label: "Sign in", hint: "Pick up where you left off", icon: LogIn },
];

export default function NotFound() {
  return (
    <main className="flex-1 grid place-items-center px-4 py-16">
      <div className="w-full max-w-xl text-center">
        <Link href="/user" className="inline-flex items-center gap-2.5" aria-label="iFind home">
          <span className="h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-xl font-bold text-[var(--text)]">
            i<span className="text-[var(--primary)]">Find</span>
          </span>
        </Link>

        <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-[var(--primary-dk)]">Error 404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)]">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-base text-[var(--text-2)] leading-relaxed">
          The link may be out of date, or the page may have moved. Here are a few places to get back on track.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/user">
            <Button size="lg" className="gap-2">
              <Compass className="h-4 w-4" aria-hidden /> Browse internships
            </Button>
          </Link>
          <Link href="/employer">
            <Button size="lg" variant="outline">Post an internship</Button>
          </Link>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-3 text-left">
          {LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="plasma-card block h-full p-4 hover:-translate-y-0.5">
                <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden />
                <p className="mt-2 text-[15px] font-semibold text-[var(--text)]">{label}</p>
                <p className="mt-0.5 text-sm text-[var(--text-2)]">{hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
