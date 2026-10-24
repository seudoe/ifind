import Link from "next/link";
import { GitBranch, ExternalLink } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const STUDENT_LINKS = [
  { label: "Browse Internships", href: "/dashboard?tab=internships" },
  { label: "My Dashboard",       href: "/dashboard?tab=overview" },
  { label: "Resume",             href: "/dashboard?tab=resume" },
  { label: "Saved",              href: "/dashboard?tab=saved" },
];

const COMPANY_LINKS = [
  { label: "About iFind", href: "#" },
  { label: "Blog",        href: "#" },
  { label: "Careers",     href: "#" },
  { label: "Contact",     href: "#" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy",  href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy",   href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-[var(--navy)] border-t-2 border-[var(--rule)] text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center mb-4" aria-label="iFind home">
              <Logo size="md" className="border border-white/20" />
            </Link>
            <p className="text-sm leading-relaxed text-white/60 max-w-xs">
              India&apos;s smartest internship platform. AI-powered matching connects students
              with opportunities at top companies — tailored to your profile.
            </p>
            <div className="flex items-center gap-2 mt-5">
              {[
                { icon: ExternalLink, label: "Twitter" },
                { icon: ExternalLink, label: "LinkedIn" },
                { icon: ExternalLink, label: "Instagram" },
                { icon: GitBranch,    label: "GitHub" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="h-8 w-8 rounded-[var(--radius-sm)] bg-white/10 flex items-center justify-center text-white/60 hover:bg-[var(--primary)] hover:text-white transition-all duration-[var(--transition)]"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <FooterColumn title="For Students" links={STUDENT_LINKS} />
          <FooterColumn title="Company"      links={COMPANY_LINKS} />
          <FooterColumn title="Legal"        links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} iFind. All rights reserved.
          </p>
          <p className="text-xs text-white/60">
            Made with ♥ for students across India
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-[0.07em] mb-3">{title}</h3>
      <ul className="space-y-2">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-white/60 hover:text-white transition-colors duration-[var(--transition)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
