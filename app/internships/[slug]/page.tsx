import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CompanyLogo } from "@/components/internships/CompanyLogo";
import { StipendBadge } from "@/components/internships/StipendBadge";
import { getSession } from "@/lib/auth";
import { formatAddresses } from "@/lib/address";
import { applyHref, authUrl } from "@/lib/authRedirect";
import { sourceLabel } from "@/lib/constants";
import { getPublicInternship } from "@/lib/publicInternships";
import { idFromSlug, internshipSlug } from "@/lib/slug";
import { formatDate, formatDuration } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  const id = idFromSlug(slug);
  return id ? getPublicInternship(id).catch(() => null) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const internship = await load((await params).slug);
  if (!internship) return { title: "Internship not found — iFind" };
  return {
    title: `${internship.name} at ${internship.company} — iFind`,
    description: (internship.summary ?? "").slice(0, 160) || `${internship.name} internship at ${internship.company}`,
  };
}

export default async function PublicInternshipPage({ params }: { params: Params }) {
  const { slug } = await params;
  const internship = await load(slug);
  if (!internship) notFound();

  const canonical = internshipSlug(internship);
  // Signed-in students get the full experience (save, apply, status) inside their dashboard
  const session = await getSession().catch(() => null);
  if (session) redirect(`/user/${session.username}/browse/${canonical}`);

  const next = applyHref(canonical);
  const location = internship.isRemote
    ? "Work from Home"
    : formatAddresses(internship.address, ["city", "state"]) || formatAddresses(internship.address, ["country"]) || "India";

  const facts = [
    { icon: internship.isRemote ? Wifi : MapPin, label: "Location", value: location },
    { icon: Clock, label: "Duration", value: internship.duration ? formatDuration(internship.duration) : "Flexible" },
    { icon: Calendar, label: "Apply by", value: internship.deadlineDate ? formatDate(internship.deadlineDate) : "Open" },
    ...(internship.openings ? [{ icon: Users, label: "Openings", value: String(internship.openings) }] : []),
  ];

  return (
    <div className="container-page py-8">
      <Link href="/internships" className="inline-flex items-center gap-1.5 label hover:text-[var(--primary)] mb-5">
        <ArrowLeft className="h-3.5 w-3.5" /> All internships
      </Link>

      <article className="plasma-card p-5 sm:p-7">
        <header className="flex items-start gap-4 pb-5 mb-5 border-b-2 border-[var(--rule)]">
          <div className="h-14 w-14 rounded-[var(--radius-sm)] bg-[var(--navy)] text-white flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
            <CompanyLogo internship={internship} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold leading-snug text-[var(--heading)]">{internship.name}</h1>
            <p className="text-sm text-[var(--text-2)] mt-1">{internship.company} · via {sourceLabel(internship.source)}</p>
            <StipendBadge stipend={internship.stipend} className="mt-2 text-sm" />
          </div>
        </header>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="label flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</dt>
              <dd className="text-[13px] font-semibold text-[var(--text)] mt-1">{value}</dd>
            </div>
          ))}
        </dl>

        {internship.summary && (
          <section className="mb-6">
            <h2 className="label mb-2">About the role</h2>
            <p className="text-[13.5px] leading-relaxed text-[var(--text)] whitespace-pre-line">{internship.summary}</p>
          </section>
        )}

        {!!internship.responsibilities?.length && (
          <section className="mb-6">
            <h2 className="label mb-2">Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1 text-[13.5px] text-[var(--text)]">
              {internship.responsibilities.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </section>
        )}

        {!!internship.skills?.length && (
          <section className="mb-6">
            <h2 className="label mb-2">Skills</h2>
            <div className="flex flex-wrap gap-1.5">{internship.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
          </section>
        )}

        {!!internship.perks?.length && (
          <section className="mb-2">
            <h2 className="label mb-2">Perks</h2>
            <div className="flex flex-wrap gap-1.5">{internship.perks.map((p) => <Badge key={p} variant="success">{p}</Badge>)}</div>
          </section>
        )}
      </article>

      {/* Apply: signed-out visitors sign in (or register) and land back on this internship inside their dashboard */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 mt-6 border-t-2 sm:border-2 border-[var(--rule)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:rounded-[var(--radius)]">
        <p className="text-[13px] text-[var(--text-2)]">Sign in to apply — you will come straight back to this internship.</p>
        <div className="flex gap-2">
          <Link href={authUrl("login", next)}><Button size="lg">Log in to apply</Button></Link>
          <Link href={authUrl("register", next)}><Button size="lg" variant="secondary">Create account</Button></Link>
        </div>
      </div>
    </div>
  );
}
