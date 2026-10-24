"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LogIn, UserPlus, Search, BookOpen } from "lucide-react";
import { cn }    from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

const NAV_LINKS = [
  { href: "/user#categories", label: "Internships", icon: Search },
  { href: "/user#how-it-works", label: "How it works", icon: BookOpen },
];

interface NavbarProps {
  /** Highlight a nav link by label (lowercase) */
  active?: string;
}

export function Navbar({ active }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)] border-b-2 border-[var(--rule)] plasma-glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-6">

          {/* Logo */}
          <Link href="/user" className="flex items-center shrink-0" aria-label="iFind home">
            <Logo size="md" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const isActive = active === label.toLowerCase();
              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 border-b-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
                    isActive
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--text-2)] hover:text-[var(--primary)] hover:border-[var(--primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
            <ThemeSwitcher compact className="w-28" />
            <Link href="/user/login">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" /> Login
              </Button>
            </Link>
            <Link href="/user/register">
              <Button variant="primary" size="sm" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Register
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden ml-auto p-2 rounded-[var(--radius-sm)] text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-sm)] font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-2)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)] transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <ThemeSwitcher className="mt-2" />
          <div className="pt-2 flex gap-2 border-t border-[var(--border)] mt-2">
            <Link href="/user/login"    className="flex-1" onClick={() => setOpen(false)}><Button variant="outline" size="sm" className="w-full">Login</Button></Link>
            <Link href="/user/register" className="flex-1" onClick={() => setOpen(false)}><Button variant="primary" size="sm" className="w-full">Register</Button></Link>
          </div>
        </div>
      )}
    </header>
  );
}
