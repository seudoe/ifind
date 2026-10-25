import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

export type AuthVariant = "student" | "employer" | "moderator";

const PANELS: Record<AuthVariant, { eyebrow: string; title: React.ReactNode; points: string[]; logoSuffix: string }> = {
  student: {
    eyebrow: "Student portal",
    title: <>Your next internship is <span className="text-white/70">one sign-in away.</span></>,
    points: [
      "Browse every listing without an account",
      "Upload your resume once and get matched to listings that fit",
      "Apply in a few clicks and track every application",
    ],
    logoSuffix: "Find",
  },
  employer: {
    eyebrow: "Employer portal",
    title: <>Hire interns who <span className="text-white/70">actually fit.</span></>,
    points: [
      "Post an internship in minutes",
      "Applicants arrive with a match score against your skills",
      "A verified company badge builds trust with students",
    ],
    logoSuffix: "Find",
  },
  moderator: {
    eyebrow: "Moderator panel",
    title: <>Keep every listing <span className="text-white/70">trustworthy.</span></>,
    points: [
      "Review scam-checked listings and approve or reject",
      "Re-run the pipeline on any single internship",
      "Manage users, employers and companies",
    ],
    logoSuffix: "Mod",
  },
};

/** Subtle in-sentence link: reads as text until hovered. */
const hint = "text-white/85 underline decoration-white/30 decoration-dotted underline-offset-4 hover:text-white hover:decoration-white/70 transition-colors";

function CrossLinks({ variant }: { variant: AuthVariant }) {
  if (variant === "student") {
    return (
      <p className="text-[13px] leading-relaxed text-white/60">
        Hiring interns? That is the <Link href="/employer/login" className={hint}>employer</Link> portal.
        Part of the review team? Head to the <Link href="/moderator/login" className={hint}>moderator</Link> sign-in.
      </p>
    );
  }
  return (
    <p className="text-[13px] leading-relaxed text-white/60">
      Looking for internships instead? Use the <Link href="/user/login" className={hint}>student sign-in</Link>.
    </p>
  );
}

interface Props {
  variant: AuthVariant;
  heading: string;
  sub: string;
  /** Top-left link on the form side. */
  back?: { href: string; label: string };
  /** Line under the form (e.g. "No account? Register"). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Split-screen auth page: story on the left (hidden on small screens), the form on the right.
 * Colours come from theme tokens, so it follows light/dark like everything else.
 */
export function AuthLayout({ variant, heading, sub, back = { href: "/", label: "iFind" }, footer, children }: Props) {
  const panel = PANELS[variant];
  // The student panel has a photo on its right: keep the text clear of it
  const textW = variant === "student" ? "max-w-[19rem] xl:max-w-sm" : "max-w-md";
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[var(--bg)]">
      {/* ── Left: brand panel (large screens only) ─────────────────────────── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white" style={{ background: "linear-gradient(160deg, var(--primary) 0%, var(--navy) 80%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-[2px]" />
          <div className="absolute bottom-24 -left-20 h-64 w-64 rounded-full bg-white/[0.07]" />
          <div className="absolute top-1/2 right-1/4 h-40 w-40 rounded-full bg-black/10" />
        </div>

        <Link href="/" className="relative self-start" aria-label="iFind home"><Logo size="md" suffix={panel.logoSuffix} className="border border-white/25" /></Link>

        <div className={`relative z-10 ${textW}`}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-white/70 mb-4">{panel.eyebrow}</p>
          <h2 className="text-[34px] font-extrabold leading-[1.15] !text-white mb-7">{panel.title}</h2>
          <ul className="space-y-3">
            {panel.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[14px] leading-snug text-white/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-white/15"><Check className="h-3 w-3" /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {variant === "student" && (
          <Image src="/hero-graduate.png" alt="" width={520} height={640} priority className="pointer-events-none absolute bottom-0 right-0 h-[52%] w-auto max-w-[46%] object-contain object-bottom opacity-95" />
        )}

        <div className={`relative z-10 ${textW}`}><CrossLinks variant={variant} /></div>
      </aside>

      {/* ── Right: the form ────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <Link href={back.href} className="text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]">← {back.label}</Link>
          <ThemeSwitcher compact className="w-28" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <div className="w-full max-w-sm">
            <div className="mb-7 text-center lg:text-left">
              <div className="mb-4 inline-flex lg:hidden"><Logo size="lg" suffix={panel.logoSuffix} /></div>
              <h1 className="text-[22px] font-extrabold text-[var(--heading)]">{heading}</h1>
              <p className="mt-1 text-sm text-[var(--text-3)]">{sub}</p>
            </div>

            {children}

            {footer && <div className="mt-5 text-sm text-[var(--text-3)]">{footer}</div>}

            {/* Small screens have no brand panel, so the other portals stay reachable (quietly) down here */}
            <div className="mt-8 lg:hidden"><MobileCrossLinks variant={variant} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileCrossLinks({ variant }: { variant: AuthVariant }) {
  const link = "text-[var(--text-2)] underline decoration-dotted underline-offset-4 hover:text-[var(--primary)]";
  return variant === "student" ? (
    <p className="text-center text-xs text-[var(--text-3)]">
      Hiring? <Link href="/employer/login" className={link}>Employer portal</Link> · Review team? <Link href="/moderator/login" className={link}>Moderator sign-in</Link>
    </p>
  ) : (
    <p className="text-center text-xs text-[var(--text-3)]">Looking for internships? <Link href="/user/login" className={link}>Student sign-in</Link></p>
  );
}
