import {
    Briefcase,
    GraduationCap,
    Code,
    Award,
    Globe,
    BookOpen,
    Users,
    Trophy,
    Heart,
    MapPin,
    Link as LinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ParsedResumeData } from "@/types";

export function ResumeParsedViewer({ data }: { data: ParsedResumeData }) {
    return (
        <div className="space-y-4">
            {data.metaDetails && (
                <Section
                    icon={<MapPin className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Contact Information"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <Field label="Name" value={data.metaDetails.name} />
                        <Field label="Email" value={data.metaDetails.email} />
                        {data.metaDetails.phone_no && (
                            <Field
                                label="Phone"
                                value={data.metaDetails.phone_no}
                            />
                        )}
                        {data.metaDetails.address && (
                            <Field
                                label="Location"
                                value={[
                                    data.metaDetails.address.city,
                                    data.metaDetails.address.state,
                                    data.metaDetails.address.country,
                                ]
                                    .filter(Boolean)
                                    .join(", ")}
                            />
                        )}
                        {data.metaDetails.github_profile && (
                            <div className="flex items-center gap-1">
                                <LinkIcon className="h-3.5 w-3.5 text-[var(--text-3)]" />
                                <a
                                    href={data.metaDetails.github_profile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--primary-dk)] hover:underline text-sm"
                                >
                                    GitHub
                                </a>
                            </div>
                        )}
                        {data.metaDetails.linkedin && (
                            <div className="flex items-center gap-1">
                                <LinkIcon className="h-3.5 w-3.5 text-[var(--text-3)]" />
                                <a
                                    href={data.metaDetails.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--primary-dk)] hover:underline text-sm"
                                >
                                    LinkedIn
                                </a>
                            </div>
                        )}
                    </div>
                </Section>
            )}

            {data.summary && (
                <Section title="Summary">
                    <p className="text-sm text-[var(--text-2)]">{data.summary}</p>
                </Section>
            )}

            {data.workHistory?.length > 0 && (
                <Section
                    icon={<Briefcase className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Work History"
                >
                    <div className="space-y-4">
                        {data.workHistory.map((w, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-blue-200 pl-3 space-y-1"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium text-sm text-[var(--text)]">
                                            {w.title}
                                        </p>
                                        <p className="text-xs text-[var(--text-2)]">
                                            {w.company} · {w.location}
                                        </p>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs shrink-0"
                                    >
                                        {w.type}
                                    </Badge>
                                </div>
                                <p className="text-xs text-[var(--text-3)]">
                                    {w.period?.start} –{" "}
                                    {w.period?.isCurrent
                                        ? "Present"
                                        : (w.period?.end ?? "N/A")}
                                </p>
                                {w.responsibilities?.length > 0 && (
                                    <BulletList
                                        label="Responsibilities"
                                        items={w.responsibilities}
                                    />
                                )}
                                {w.achievements?.length > 0 && (
                                    <BulletList
                                        label="Achievements"
                                        items={w.achievements}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.education?.length > 0 && (
                <Section
                    icon={<GraduationCap className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Education"
                >
                    <div className="space-y-3">
                        {data.education.map((e, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-green-200 pl-3 space-y-0.5"
                            >
                                <p className="font-medium text-sm text-[var(--text)]">
                                    {e.institution}
                                </p>
                                <p className="text-xs text-[var(--text-2)]">
                                    {e.field?.type} in {e.field?.course}
                                </p>
                                <p className="text-xs text-[var(--text-3)]">
                                    {e.period?.start} –{" "}
                                    {e.period?.isCurrent
                                        ? "Present"
                                        : (e.period?.end ?? "N/A")}
                                </p>
                                {e.output && (
                                    <p className="text-xs text-[var(--text-2)]">
                                        {e.output}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.skills?.length > 0 && (
                <Section
                    icon={<Code className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Skills"
                >
                    <div className="space-y-3">
                        {data.skills.map((s, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-1">
                                    <p className="text-sm font-medium text-[var(--text)]">
                                        {s.field}
                                    </p>
                                    {s.yearsOfExperience ? (
                                        <span className="text-xs text-[var(--text-3)]">
                                            {s.yearsOfExperience} yrs
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {s.tools?.map((t, j) => (
                                        <Badge
                                            key={j}
                                            variant="secondary"
                                            className="text-xs"
                                        >
                                            {t.name}
                                            {t.score ? ` (${t.score}%)` : ""}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.projects?.length > 0 && (
                <Section
                    icon={<Code className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Projects"
                >
                    <div className="space-y-4">
                        {data.projects.map((p, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-purple-200 pl-3 space-y-1.5"
                            >
                                <p className="font-medium text-sm text-[var(--text)]">
                                    {p.title}
                                </p>
                                {p.role && (
                                    <p className="text-xs text-[var(--text-2)]">
                                        {p.role}
                                    </p>
                                )}
                                {p.problemStatement && (
                                    <p className="text-xs text-[var(--text-2)] italic">
                                        {p.problemStatement}
                                    </p>
                                )}
                                {p.techStack?.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {p.techStack.map((t, j) => (
                                            <Badge
                                                key={j}
                                                variant="secondary"
                                                className="text-xs"
                                            >
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {p.description?.length > 0 && (
                                    <BulletList items={p.description} />
                                )}
                                {p.links && (
                                    <div className="flex gap-3 text-xs">
                                        {p.links.repo && (
                                            <a
                                                href={p.links.repo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[var(--primary-dk)] hover:underline"
                                            >
                                                Repo
                                            </a>
                                        )}
                                        {p.links.live && (
                                            <a
                                                href={p.links.live}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[var(--primary-dk)] hover:underline"
                                            >
                                                Live
                                            </a>
                                        )}
                                        {p.links.demo && (
                                            <a
                                                href={p.links.demo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[var(--primary-dk)] hover:underline"
                                            >
                                                Demo
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.certifications?.length > 0 && (
                <Section
                    icon={<Award className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Certifications"
                >
                    <div className="space-y-2">
                        {data.certifications.map((c, i) => (
                            <div key={i} className="flex justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium text-[var(--text)]">
                                        {c.name}
                                    </p>
                                    <p className="text-xs text-[var(--text-2)]">
                                        {c.issuer}
                                    </p>
                                    {c.skillsEarned?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {c.skillsEarned.map((s, j) => (
                                                <Badge
                                                    key={j}
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {s}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-[var(--text-3)] shrink-0">
                                    {c.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.languages?.length > 0 && (
                <Section
                    icon={<Globe className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Languages"
                >
                    <div className="flex flex-wrap gap-2">
                        {data.languages.map((l, i) => (
                            <Badge key={i} variant="secondary">
                                {l.lang} – {l.proficiency}
                                {l.score ? ` (${l.score})` : ""}
                            </Badge>
                        ))}
                    </div>
                </Section>
            )}

            {data.publications?.length > 0 && (
                <Section
                    icon={<BookOpen className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Publications"
                >
                    <div className="space-y-2">
                        {data.publications.map((p, i) => (
                            <div key={i}>
                                <a
                                    href={p.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-[var(--primary-dk)] hover:underline"
                                >
                                    {p.title}
                                </a>
                                <p className="text-xs text-[var(--text-2)]">
                                    {p.platform} · {p.type} · {p.date}
                                </p>
                                {p.keywords?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {p.keywords.map((k, j) => (
                                            <Badge
                                                key={j}
                                                variant="secondary"
                                                className="text-xs"
                                            >
                                                {k}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.awards?.length > 0 && (
                <Section
                    icon={<Trophy className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Awards"
                >
                    <div className="space-y-2">
                        {data.awards.map((a, i) => (
                            <div key={i}>
                                <p className="text-sm font-medium text-[var(--text)]">
                                    {a.name}
                                </p>
                                <p className="text-xs text-[var(--text-2)]">
                                    {a.issuingBody} · {a.date}
                                </p>
                                {a.justification && (
                                    <p className="text-xs text-[var(--text-2)] mt-0.5">
                                        {a.justification}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.affiliations?.length > 0 && (
                <Section
                    icon={<Users className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Affiliations"
                >
                    <div className="space-y-3">
                        {data.affiliations.map((a, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-orange-200 pl-3 space-y-0.5"
                            >
                                <div className="flex justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium text-[var(--text)]">
                                            {a.organization}
                                        </p>
                                        <p className="text-xs text-[var(--text-2)]">
                                            {a.role} · {a.type}
                                        </p>
                                    </div>
                                    <span className="text-xs text-[var(--text-3)] shrink-0">
                                        {a.period?.start} –{" "}
                                        {a.period?.isCurrent
                                            ? "Present"
                                            : (a.period?.end ?? "N/A")}
                                    </span>
                                </div>
                                {a.impact?.length > 0 && (
                                    <BulletList items={a.impact} />
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.interests?.length > 0 && (
                <Section
                    icon={<Heart className="h-4 w-4 text-[var(--primary-dk)]" />}
                    title="Interests"
                >
                    <div className="space-y-2">
                        {data.interests.map((it, i) => (
                            <div key={i}>
                                <p className="text-sm font-medium text-[var(--text)]">
                                    {it.activity}
                                </p>
                                <p className="text-xs text-[var(--text-2)]">
                                    {it.description}
                                </p>
                                {it.commitmentMetric && (
                                    <p className="text-xs text-[var(--text-3)]">
                                        {it.commitmentMetric}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

function Section({
    icon,
    title,
    children,
}: {
    icon?: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3 border border-gray-100 shadow-sm">
            <h4 className="font-semibold text-[var(--text)] flex items-center gap-2 text-sm">
                {icon}
                {title}
            </h4>
            {children}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-[var(--text-3)] text-sm">{label}: </span>
            <span className="font-medium text-sm text-[var(--text)]">{value}</span>
        </div>
    );
}

// Resume data from older extractions (and the demo account) sometimes stores a
// single string where the schema expects a list.
function BulletList({ label, items }: { label?: string; items: string[] | string }) {
    const list = Array.isArray(items) ? items : [items];
    return (
        <div>
            {label && (
                <p className="text-xs font-medium text-[var(--text-2)] mb-0.5">
                    {label}:
                </p>
            )}
            <ul className="list-disc list-inside space-y-0.5">
                {list.map((item, i) => (
                    <li key={i} className="text-xs text-[var(--text-2)]">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}
