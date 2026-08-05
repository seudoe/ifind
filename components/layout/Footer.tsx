import Link from "next/link";
import { Briefcase, GitBranch, ExternalLink } from "lucide-react";

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
    <footer className="bg-[var(--text)] text-[var(--surface-2)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                i<span className="text-[var(--primary)]">Find</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-[var(--text-3)] max-w-xs">
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
                  className="h-8 w-8 rounded-[var(--radius-sm)] bg-white/10 flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--primary)] hover:text-white transition-all duration-[var(--transition)]"
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
          <p className="text-xs text-[var(--text-3)]">
            © {new Date().getFullYear()} iFind. All rights reserved.
          </p>
          <p className="text-xs text-[var(--text-3)]">
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
      <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-3">{title}</h3>
      <ul className="space-y-2">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-[var(--text-3)] hover:text-white transition-colors duration-[var(--transition)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
