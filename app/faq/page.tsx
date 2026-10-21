import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "How iFind matches you with internships, how listings are checked, what AI credits are, and how to delete your account.",
  alternates: { canonical: "/faq" },
  openGraph: {
    images: [OG_IMAGE],
    url: "/faq",
    title: "iFind FAQ — internships, matching, AI credits and your account",
    description: "Straight answers about how iFind works.",
  },
};

// Every answer below is taken from how the product actually behaves (daily credit default in lib/usage/config.ts,
// extraction limits in lib/resumeParser.ts, deletion flow in app/api/user/delete-account, moderation flow in README).
// This array drives both the visible text and the FAQPage JSON-LD, so the two can't drift apart.
const FAQS: { q: string; a: string }[] = [
  {
    q: "Does iFind cost anything for students?",
    a: "There is no payment or subscription for students in iFind today: you can create an account, browse internships, save them and apply without paying. The AI tools (resume chat, career assistant and internship match) run on a daily credit allowance instead, described below.",
  },
  {
    q: "How does iFind match me with internships?",
    a: "Upload your resume as a PDF (up to 5 MB). iFind extracts your skills, education and experience from it, and then ranks internships against that profile so the best matches appear first on your Home page. The more complete your profile, the better the matches.",
  },
  {
    q: "How does iFind check that internships are genuine?",
    a: "Internships collected from other sites are validated, de-duplicated and given a scam score. Clear ones are published automatically and the rest wait for a moderator to review them. Internships posted by employers on iFind are checked the same way, and a post from an unverified company or with a poor score is reviewed by a moderator before students see it. No check is perfect: always read the listing carefully and never pay money to apply.",
  },
  {
    q: "What are AI credits?",
    a: "AI credits are a daily allowance for the AI tools. Each student gets 40 credits a day by default, and the balance is shown inside the tools. Resume extraction is separate: the standard extractor is unlimited, and connecting and verifying your LinkedIn account unlocks 3 higher-accuracy AI extractions per month.",
  },
  {
    q: "Can I delete my account?",
    a: "Yes. Go to Settings, choose Delete Account and type DELETE to confirm. Your account is scheduled for deletion, and you can restore it within 30 days by simply signing in again. After 30 days your profile and application data are permanently reset.",
  },
];

export default function FaqPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Breadcrumbs items={[{ label: "FAQ" }]} />

          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-base sm:text-lg text-[var(--text-2)] leading-relaxed">
            How iFind works, in plain language.
          </p>

          <div className="mt-8 space-y-3">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="plasma-card group p-5 open:shadow-[var(--shadow)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base sm:text-lg font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  {q}
                  <span
                    aria-hidden
                    className="shrink-0 text-xl leading-none text-[var(--primary)] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-[var(--text-2)]">{a}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 plasma-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-[var(--text)]">Ready to find your internship?</p>
              <p className="text-sm text-[var(--text-2)] mt-0.5">Create a free profile and upload your resume.</p>
            </div>
            <Link
              href="/user/register"
              className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--primary)] px-5 py-2.5 text-base font-semibold text-white hover:bg-[var(--primary-dk)] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </main>
      <Footer />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />
    </div>
  );
}
