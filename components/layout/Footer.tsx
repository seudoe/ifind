"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, ExternalLink } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { isSmallScreen } from "@/lib/isSmallScreen";

const COMPANY_LINKS = [
  { label: "About iFind", href: "#" },
  { label: "Blog",        href: "#" },
  { label: "Careers",     href: "#" },
  { label: "Contact",     href: "#" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy",  href: "/privacy-policy" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy",   href: "#" },
];

export function Footer() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isSmallScreen());
  }, []);

  const studentLinks = [
    { label: "Browse Internships", href: "/internships" },
    { label: "Log in",             href: isMobile ? "/phone" : "/user/login" },
    { label: "Create account",     href: isMobile ? "/phone" : "/user/register" },
    { label: "Employer portal",    href: isMobile ? "/phone" : "/employer" },
  ];

  return (
    <footer className="bg-[var(--navy)] border-t-2 border-[var(--rule)] text-white/80">
      <div className="container-page py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href={isMobile ? "/phone" : "/user"} className="inline-flex items-center mb-4" aria-label="iFind home">
              <Logo size="md" onDark />
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
          <FooterColumn title="For Students" links={studentLinks} />
          <FooterColumn title="Company"      links={COMPANY_LINKS} />
          <FooterColumn title="Legal"        links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} iFind. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy-policy"
              className="inline-flex items-center rounded-[var(--radius-sm)] border border-white/25 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <p className="text-xs text-white/60">Made with ♥ for students across India</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-white/90 mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link href={href} className="text-sm text-white/65 hover:text-white transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
