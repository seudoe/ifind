"use client";

import {
  MapPin, Mail, Phone, GitBranch, Link2,
  Briefcase, GraduationCap, Code2, Award, Globe,
  BookOpen, Users, Heart, ExternalLink, Edit2,
} from "lucide-react";
import { Badge }   from "@/components/ui/Badge";
import { Button }  from "@/components/ui/Button";
import { Avatar }  from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { User, ParsedResumeData, WorkHistory, ResumeEducation, Skill } from "@/types";

// ── Hardcoded mock for visual preview ─────────────────────────────────────
const MOCK_USER: User = {
  _id: "1",
  name: "Rahul Sharma",
  username: "rahulsharma",
  email: "rahul@example.com",
  role: "user",
  profilePicture: null,
  phone: "+91 98765 43210",
  city: "Bangalore",
  state: "Karnataka",
  country: "India",
  resume: { driveFileId: "abc", driveViewLink: null, uploadedAt: "2026-06-01" },
  appliedInternships: [],
  savedInternships: [],
  profileCompletionScore: 72,
  createdAt: "2026-01-01",
  updatedAt: "2026-06-01",
};

const MOCK_PARSED: ParsedResumeData = {
  summary: "Final year Computer Science student at DJSCE Mumbai with a passion for full-stack development and AI. Built production apps used by 500+ users. Looking for challenging internships at product-first companies.",
  metaDetails: {
    name: "Rahul Sharma",
    phone_no: "+91 98765 43210",
    email: "rahul@example.com",
    github_profile: "https://github.com/rahulsharma",
    linkedin: "https://linkedin.com/in/rahulsharma",
    address: { city: "Bangalore", country: "India", postal_code: "560001" },
    extra_links: [{ name: "Portfolio", link: "https://rahulsharma.dev" }],
  },
  workHistory: [
    {
      title: "Full Stack Developer Intern",
      company: "Razorpay",
      location: "Bangalore",
      type: "internship",
      period: { start: "Jan 2026", end: "Apr 2026", isCurrent: false },
      responsibilities: ["Built payment dashboard widgets using React + TypeScript", "Optimized API response times by 35% via query restructuring"],
      achievements: ["Shipped 3 features to production used by 10,000+ merchants"],
    },
  ],
  education: [
    {
      institution: "DJSCE Mumbai",
      field: { type: "B.E.", course: "Computer Engineering" },
      period: { start: "2022", end: "2026", isCurrent: false },
      output: "CGPA: 9.1/10",
    },
  ],
  skills: [
    { field: "Frontend", yearsOfExperience: 2, lastUsed: "2026", tools: [{ name: "React" }, { name: "TypeScript" }, { name: "Tailwind" }] },
    { field: "Backend",  yearsOfExperience: 1, lastUsed: "2026", tools: [{ name: "Node.js" }, { name: "PostgreSQL" }] },
  ],
  projects: [
    {
      title: "iFind — Internship Finder Platform",
      role: "Full Stack Developer",
      links: { repo: "https://github.com/rahulsharma/ifind", live: "https://ifind.dev" },
      techStack: ["Next.js", "MongoDB", "TypeScript", "Tailwind"],
      problemStatement: "Students waste hours manually browsing internship sites with no skill matching.",
      metrics: ["500+ active users", "10,000+ internships indexed"],
      technicalChallenges: ["Built a TF-IDF + BERT hybrid recommendation engine"],
      description: ["Resume parsing with Gemini AI", "Real-time scam detection pipeline"],
      architecture: "Monorepo Next.js with Python microservice for ML",
    },
  ],
  certifications: [
    { name: "AWS Cloud Practitioner", issuer: "Amazon Web Services", skillsEarned: ["Cloud", "AWS"], type: "Cloud", date: "2025-08" },
  ],
  languages: [{ lang: "English", proficiency: "Fluent" }, { lang: "Hindi", proficiency: "Native" }],
  publications: [],
  affiliations: [],
  awards: [],
  interests: [{ activity: "Open Source", description: "Contribute to React ecosystem projects" }],
};

// ── Page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const user   = MOCK_USER;
  const parsed = MOCK_PARSED;
  const meta   = parsed.metaDetails;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between plasma-glass">
        <div className="flex items-center gap-2">
          <Avatar src={user.profilePicture} name={user.name} size="xs" />
          <span className="text-sm font-semibold text-[var(--text)]">{user.name}</span>
          <span className="text-xs text-[var(--text-3)]">@{user.username}</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Edit2 className="h-3.5 w-3.5" /> Edit Profile
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">

        {/* ── Left column ───────────────────────────────────────────── */}
        <aside className="space-y-4">

          {/* Identity card */}
          <div className="plasma-card p-5 text-center">
            <div className="relative inline-block mb-3">
              <Avatar src={user.profilePicture} name={user.name} size="xl" />
            </div>
            <h1 className="text-base font-bold text-[var(--text)]">{user.name}</h1>
            <p className="text-xs text-[var(--text-3)] mt-0.5">@{user.username}</p>
            {parsed.summary && (
              <p className="text-xs text-[var(--text-2)] mt-3 leading-relaxed text-left border-t border-[var(--border)] pt-3">
                {parsed.summary}
              </p>
            )}
          </div>

          {/* Contact */}
          <div className="plasma-card p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-widest">Contact</h3>
            {[
              { icon: Mail,    val: meta.email,            href: `mailto:${meta.email}` },
              { icon: Phone,   val: meta.phone_no,         href: `tel:${meta.phone_no}` },
              { icon: MapPin,  val: `${meta.address.city}, ${meta.address.country}`, href: null },
              { icon: GitBranch,  val: "GitHub",              href: meta.github_profile },
              { icon: Link2,     val: "LinkedIn",            href: meta.linkedin },
              ...(meta.extra_links.map((l) => ({ icon: Link2, val: l.name, href: l.link }))),
            ].filter((r) => r.val).map(({ icon: Icon, val, href }) => (
              <div key={val} className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                <Icon className="h-3.5 w-3.5 text-[var(--text-3)] shrink-0" />
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--primary)] transition-colors truncate">
                    {val}
                  </a>
                ) : <span className="truncate">{val}</span>}
              </div>
            ))}
          </div>

          {/* Profile score */}
          <div className="plasma-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-widest">Profile Score</h3>
              <span className="text-sm font-bold text-[var(--primary)]">{user.profileCompletionScore}%</span>
            </div>
            <ProgressBar value={user.profileCompletionScore} />
          </div>

          {/* Languages */}
          {parsed.languages.length > 0 && (
            <div className="plasma-card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Languages
              </h3>
              {parsed.languages.map((l) => (
                <div key={l.lang} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text)]">{l.lang}</span>
                  <Badge variant="secondary" className="text-[10px]">{l.proficiency}</Badge>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Right column ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Work history */}
          {parsed.workHistory.length > 0 && (
            <Section icon={<Briefcase className="h-4 w-4" />} title="Experience">
              <div className="space-y-4">
                {parsed.workHistory.map((w, i) => <WorkEntry key={i} w={w} />)}
              </div>
            </Section>
          )}

          {/* Education */}
          {parsed.education.length > 0 && (
            <Section icon={<GraduationCap className="h-4 w-4" />} title="Education">
              <div className="space-y-3">
                {parsed.education.map((e, i) => <EduEntry key={i} e={e} />)}
              </div>
            </Section>
          )}

          {/* Skills */}
          {parsed.skills.length > 0 && (
            <Section icon={<Code2 className="h-4 w-4" />} title="Skills">
              <div className="space-y-3">
                {parsed.skills.map((s, i) => <SkillEntry key={i} s={s} />)}
              </div>
            </Section>
          )}

          {/* Projects */}
          {parsed.projects.length > 0 && (
            <Section icon={<Code2 className="h-4 w-4" />} title="Projects">
              <div className="space-y-4">
                {parsed.projects.map((p, i) => (
                  <div key={i} className="border-l-2 border-[var(--primary)] pl-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--text)]">{p.title}</h4>
                        {p.role && <p className="text-xs text-[var(--text-3)]">{p.role}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {p.links.repo  && <a href={p.links.repo}  target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline text-xs flex items-center gap-1"><GitBranch className="h-3 w-3" />Repo</a>}
                        {p.links.live  && <a href={p.links.live}  target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline text-xs flex items-center gap-1"><ExternalLink className="h-3 w-3" />Live</a>}
                      </div>
                    </div>
                    {p.problemStatement && <p className="text-xs text-[var(--text-2)] italic">{p.problemStatement}</p>}
                    <div className="flex flex-wrap gap-1">
                      {p.techStack.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                    </div>
                    {p.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {p.metrics.map((m) => (
                          <span key={m} className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                    )}
                    {p.description.length > 0 && (
                      <ul className="space-y-0.5">
                        {p.description.map((d, j) => (
                          <li key={j} className="text-xs text-[var(--text-2)] flex gap-1.5"><span className="text-[var(--text-3)]">•</span>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Certifications */}
          {parsed.certifications.length > 0 && (
            <Section icon={<Award className="h-4 w-4" />} title="Certifications">
              <div className="space-y-3">
                {parsed.certifications.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">{c.name}</p>
                      <p className="text-xs text-[var(--text-3)]">{c.issuer}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.skillsEarned.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-3)] shrink-0">{c.date}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Interests */}
          {parsed.interests.length > 0 && (
            <Section icon={<Heart className="h-4 w-4" />} title="Interests">
              <div className="flex flex-wrap gap-2">
                {parsed.interests.map((it) => (
                  <span key={it.activity} className="text-xs text-[var(--text-2)] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1 rounded-[var(--radius-sm)]">
                    {it.activity}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="plasma-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)] mb-4 pb-3 border-b border-[var(--border)]">
        <span className="text-[var(--primary)]">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function WorkEntry({ w }: { w: WorkHistory }) {
  return (
    <div className="border-l-2 border-[var(--border)] pl-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text)]">{w.title}</h4>
          <p className="text-xs text-[var(--text-3)]">{w.company} · {w.location}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">{w.type}</Badge>
      </div>
      <p className="text-xs text-[var(--text-3)]">
        {w.period.start} – {w.period.isCurrent ? "Present" : (w.period.end ?? "N/A")}
      </p>
      {w.responsibilities.length > 0 && (
        <ul className="space-y-0.5 pt-1">
          {w.responsibilities.map((r, i) => (
            <li key={i} className="text-xs text-[var(--text-2)] flex gap-1.5"><span className="text-[var(--text-3)]">•</span>{r}</li>
          ))}
        </ul>
      )}
      {w.achievements.length > 0 && (
        <ul className="space-y-0.5">
          {w.achievements.map((a, i) => (
            <li key={i} className="text-xs text-green-700 bg-green-50 rounded px-2 py-0.5 flex gap-1.5"><span>🏆</span>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EduEntry({ e }: { e: ResumeEducation }) {
  return (
    <div className="border-l-2 border-[var(--border)] pl-3 space-y-0.5">
      <h4 className="text-sm font-semibold text-[var(--text)]">{e.institution}</h4>
      <p className="text-xs text-[var(--text-2)]">{e.field.type} in {e.field.course}</p>
      <p className="text-xs text-[var(--text-3)]">{e.period.start} – {e.period.isCurrent ? "Present" : (e.period.end ?? "N/A")}</p>
      {e.output && <p className="text-xs text-[var(--primary)] font-medium">{e.output}</p>}
    </div>
  );
}

function SkillEntry({ s }: { s: Skill }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[var(--text)]">{s.field}</span>
        <span className="text-xs text-[var(--text-3)]">{s.yearsOfExperience} yr{s.yearsOfExperience !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {s.tools.map((t) => (
          <span key={t.name} className="text-xs px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] text-[var(--primary)] border border-[var(--primary)]/20">
            {t.name}{t.score ? ` · ${t.score}%` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
