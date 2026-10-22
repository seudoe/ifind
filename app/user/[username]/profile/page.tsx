"use client";

import { safeHref } from "@/lib/safeUrl";
import { useState } from "react";
import {
  Award, BookOpen, BriefcaseBusiness, Building2, Edit3, FileText, GraduationCap, Link2, Mail, MapPin, Phone, Sparkles, UserRound, Users
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LinkedInVerificationBanner } from "@/components/dashboard/LinkedInVerificationBanner";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import type { ParsedResumeData, User } from "@/types";
import { QuickLinks } from "@/components/profile/QuickLinks";
import { ProfileEditDrawer } from "@/components/profile/ProfileEditDrawer";
import { emptyResume, type EditSection } from "@/components/profile/shared";

export default function ProfilePage() {
  const { data, error, mutate } = useStudentDashboard();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSection, setEditSection] = useState<EditSection>("personal");

  if (!data) return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{error ?? "Loading profile…"}</main>;

  const user = data.user;
  const resume = user.resume?.parsedData ?? emptyResume(user);
  const education = resume.education[0];
  const internships = resume.workHistory.filter((entry) => entry.type === "internship");
  const employment = resume.workHistory.filter((entry) => entry.type !== "internship");
  const missing = [
    !user.profilePicture && "Upload photo",
    !internships.length && "Add internship",
    !resume.certifications.length && "Add certificates",
  ].filter(Boolean) as string[];

  const triggerEdit = (section: EditSection) => {
    setEditSection(section);
    setIsEditOpen(true);
  };

  return (
    <>
      <div className="space-y-5">
        <LinkedInVerificationBanner linkedinDetails={user.linkedinDetails} />
        <ProfileHeader 
          user={user} 
          education={education ? `${education.field.type} · ${education.field.course}` : "Student profile"} 
          missing={missing} 
          onEditClick={() => triggerEdit("personal")}
        />

        <div className="flex items-center gap-6 border-b border-[var(--border)] px-2">
          <span className="border-b-2 border-[var(--primary)] pb-3 text-sm font-semibold text-[var(--text)]">View & Edit</span>
          <span className="pb-3 text-sm text-[var(--text-3)]">Activity insights</span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
          <aside className="h-fit plasma-card p-4 lg:sticky lg:top-20">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Quick links</h2>
            <QuickLinks />
          </aside>

          <div className="space-y-4">
            <Panel id="preferences" icon={<Sparkles />} title="Your career preferences" onEditClick={() => triggerEdit("preferences")}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Detail label="Preferred work" value="Internships" />
                <Detail label="Availability" value="Add work availability" accent />
                <Detail label="Preferred location" value={[resume.metaDetails?.address?.city || user.city, resume.metaDetails?.address?.state || user.state, resume.metaDetails?.address?.country || user.country].filter(Boolean).join(", ") || "Add preferred location"} />
              </div>
            </Panel>

            <Panel id="education" icon={<GraduationCap />} title="Education" onEditClick={() => triggerEdit("education")} add>
              {resume.education.length ? <div className="space-y-4">{resume.education.map((entry, index) => <div key={index} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0"><p className="text-sm font-semibold text-[var(--text)]">{entry.field.type} in {entry.field.course}</p><p className="mt-0.5 text-xs text-[var(--text-2)]">{entry.institution}</p><p className="mt-1 text-xs text-[var(--text-3)]">{entry.period.start} – {entry.period.isCurrent ? "Present" : entry.period.end ?? ""}{entry.output ? ` · ${entry.output}` : ""}</p></div>)}</div> : <Empty text="Add your education to show your academic background." />}
            </Panel>

            <Panel id="skills" icon={<BookOpen />} title="Key skills" onEditClick={() => triggerEdit("skills")}>
              {resume.skills.length ? (
                <div className="space-y-4">
                  {resume.skills.map((group, index) => (
                    <div key={`${group.field}-${index}`}>
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--text)]">{group.field}</p>
                        {group.yearsOfExperience > 0 && <p className="text-xs text-[var(--text-3)]">{group.yearsOfExperience} yr{group.yearsOfExperience === 1 ? "" : "s"}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.tools.map((tool) => <Badge key={tool.name} variant="secondary" className="px-2.5 py-1 text-xs">{tool.name}{tool.score ? ` · ${tool.score}%` : ""}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Add skills from your profile or resume." />
              )}
            </Panel>

            <Panel id="languages" icon={<Link2 />} title="Languages" onEditClick={() => triggerEdit("languages")} add>
              {resume.languages.length ? <div className="space-y-3">{resume.languages.map((language) => <div key={language.lang}><p className="text-sm font-medium text-[var(--text)]">{language.lang}</p><p className="text-xs text-[var(--text-3)]">{language.proficiency}</p></div>)}</div> : <Empty text="Add languages you can speak, read, or write." />}
            </Panel>

            <ExperiencePanel id="internships" title="Internships" entries={internships} empty="Tell employers about your internships, projects, and skills learned." onEditClick={() => triggerEdit("internships")} />

            <Panel id="projects" icon={<Building2 />} title="Projects" onEditClick={() => triggerEdit("projects")} add>
              {resume.projects.length ? (
                <div className="space-y-5">
                  {resume.projects.map((project, index) => (
                    <div key={index} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text)]">{project.title}</p>
                        {project.role && <span className="text-xs text-[var(--text-3)]">{project.role}</span>}
                      </div>

                      {project.problemStatement && (
                        <p className="text-xs italic text-[var(--text-2)]">{project.problemStatement}</p>
                      )}

                      {project.techStack && project.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {project.techStack.map((tech) => (
                            <Badge key={tech} variant="secondary" className="text-[10px]">{tech}</Badge>
                          ))}
                        </div>
                      )}

                      {project.description && project.description.length > 0 && (
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-[var(--text-2)]">
                          {(Array.isArray(project.description) ? project.description : [project.description]).map((desc, i) => (
                            <li key={i}>{desc}</li>
                          ))}
                        </ul>
                      )}

                      {project.metrics && project.metrics.length > 0 && (
                        <div className="text-xs text-[var(--text-2)]">
                          <span className="font-medium text-[var(--text-3)]">Metrics: </span>
                          {project.metrics.join(" · ")}
                        </div>
                      )}

                      {project.technicalChallenges && project.technicalChallenges.length > 0 && (
                        <div className="text-xs text-[var(--text-2)]">
                          <span className="font-medium text-[var(--text-3)]">Technical Challenges: </span>
                          {project.technicalChallenges.join(" · ")}
                        </div>
                      )}

                      {project.architecture && (
                        <div className="text-xs text-[var(--text-2)]">
                          <span className="font-medium text-[var(--text-3)]">Architecture: </span>
                          {project.architecture}
                        </div>
                      )}

                      {project.links && (project.links.repo || project.links.live || project.links.demo) && (
                        <div className="flex flex-wrap gap-3 pt-1 text-xs">
                          {project.links.repo && (
                            <a href={safeHref(project.links.repo)} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
                              <Link2 className="h-3 w-3" /> Repository
                            </a>
                          )}
                          {project.links.live && (
                            <a href={safeHref(project.links.live)} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
                              <Link2 className="h-3 w-3" /> Live Demo
                            </a>
                          )}
                          {project.links.demo && (
                            <a href={safeHref(project.links.demo)} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
                              <Link2 className="h-3 w-3" /> Demo
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Add projects that demonstrate your work and skills." />
              )}
            </Panel>

            <Panel id="summary" icon={<UserRound />} title="Profile summary" onEditClick={() => triggerEdit("summary")} add={!resume.summary}>
              {resume.summary ? <p className="text-sm leading-6 text-[var(--text-2)]">{resume.summary}</p> : <Empty text="Write a short summary highlighting your education, interests, and career goals." />}
            </Panel>

            <Panel id="accomplishments" icon={<Award />} title="Accomplishments" onEditClick={() => triggerEdit("accomplishments")}>
              <div className="divide-y divide-[var(--border)]"> 
                <Accomplishment title="Certifications" entries={resume.certifications.map((entry) => `${entry.name}${entry.issuer ? ` · ${entry.issuer}` : ""}`)} onEditClick={() => triggerEdit("accomplishments")} />
                <Accomplishment title="Awards" entries={resume.awards.map((entry) => entry.name)} onEditClick={() => triggerEdit("accomplishments")} />
                <Accomplishment title="Clubs & committees" entries={resume.affiliations.map((entry) => `${entry.organization}${entry.role ? ` · ${entry.role}` : ""}`)} onEditClick={() => triggerEdit("accomplishments")} />
              </div>
            </Panel>

            <ExperiencePanel id="employment" title="Employment" entries={employment} empty="Add work experience to show what you have done and learned." onEditClick={() => triggerEdit("employment")} />

            <Panel id="resume" icon={<FileText />} title="Resume" onEditClick={() => triggerEdit("personal")}>
              {user.resume?.uploadedAt ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-[var(--text)]">Resume uploaded</p><p className="text-xs text-[var(--text-3)]">Uploaded {new Date(user.resume.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div><button type="button" className="rounded-[var(--radius-sm)] border border-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary)]">Update resume</button></div> : <Empty text="Upload a resume to enrich this profile with your experience and skills." />}
            </Panel>
          </div>
        </div>
      </div>

      {/* Dynamic Edit Drawer popup */}
      <ProfileEditDrawer 
        user={user} 
        section={editSection}
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        onSaveSuccess={mutate}
      />
    </>
  );
}

function ProfileHeader({ user, education, missing, onEditClick }: { user: User; education: string; missing: string[]; onEditClick: () => void }) {
  const meta = user.resume?.parsedData?.metaDetails;
  const name = meta?.name || user.name;
  const email = meta?.email || user.email;
  const phone = meta?.phone_no || user.phone;
  const gender = meta?.gender || user.gender;
  const location = meta?.address?.city || meta?.address?.state || meta?.address?.country
    ? [meta.address.city, meta.address.state, meta.address.country].filter(Boolean).join(", ")
    : [user.city, user.state, user.country].filter(Boolean).join(", ");

  const github = meta?.github_profile;
  const linkedin = meta?.linkedin;
  const extraLinks = meta?.extra_links || [];

  return (
    <section className="plasma-card grid gap-5 p-5 sm:grid-cols-[110px_minmax(0,1fr)] lg:grid-cols-[110px_minmax(0,1fr)_235px]">
      <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--success)] bg-[var(--surface-2)]">
        <Avatar src={user.profilePicture} name={name} size="lg" />
        <span className="absolute -bottom-2 rounded-full bg-[var(--surface)] px-2 text-xs font-bold text-[var(--success)]">{user.profileCompletionScore}%</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-bold text-[var(--text)]">{name}</h1>
          <Edit3 className="h-3.5 w-3.5 text-[var(--primary)] cursor-pointer hover:opacity-85" onClick={onEditClick} />
        </div>
        <p className="mt-1 text-sm font-medium text-[var(--text-2)]">{education}</p>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">@{user.username}</p>

        {(linkedin || github || extraLinks.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {linkedin && (
              <a href={safeHref(linkedin)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#0a66c2] hover:underline">
                <Link2 className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {github && (
              <a href={safeHref(github)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text)] hover:underline">
                <Link2 className="h-3 w-3" /> GitHub
              </a>
            )}
            {extraLinks.map((item, idx) => (
              <a key={idx} href={safeHref(item.link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
                <Link2 className="h-3 w-3" /> {item.name || "Link"}
              </a>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-2)] sm:grid-cols-2 lg:grid-cols-3">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--text-3)]" />{location || "Add address"}</span>
          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[var(--text-3)]" />{phone || "Add phone number"}</span>
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[var(--text-3)]" />{gender || "Add gender"}</span>
          <span className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-3"><Mail className="h-3.5 w-3.5 text-[var(--text-3)]" />{email}</span>
        </div>
      </div>
      <div className="rounded-[var(--radius-sm)] bg-[var(--primary-bg)] p-4 sm:col-span-2 lg:col-span-1">
        <p className="text-xs font-semibold text-[var(--text)]">Complete your profile</p>
        <div className="mt-3 space-y-2">
          {missing.length ? missing.map((item) => <div key={item} className="flex items-center justify-between gap-2 text-xs text-[var(--text-2)]"><span>{item}</span><span className="shrink-0 whitespace-nowrap text-[var(--success)]">+ improve</span></div>) : <p className="text-xs text-[var(--success)]">Your profile is looking complete.</p>}
        </div>
        <button type="button" className="mt-4 w-full rounded-[var(--radius-sm)] bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white">Review missing details</button>
      </div>
    </section>
  );
}

function Panel({ id, icon, title, add, onEditClick, children }: { id: string; icon: React.ReactNode; title: string; add?: boolean; onEditClick?: () => void; children: React.ReactNode }) { return <section id={id} className="plasma-card scroll-mt-20 p-5"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="text-[var(--primary)]">{icon}</span><h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2><Edit3 className="h-3.5 w-3.5 text-[var(--primary)] cursor-pointer hover:opacity-85" onClick={onEditClick} /></div>{add && <button type="button" onClick={onEditClick} className="text-xs font-semibold text-[var(--primary)]">Add</button>}</div>{children}</section>; }
function Detail({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div><p className="text-xs text-[var(--text-3)]">{label}</p><p className={`mt-1 text-sm font-medium ${accent ? "text-[var(--primary)]" : "text-[var(--text-2)]"}`}>{value}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="text-xs leading-5 text-[var(--text-3)]">{text}</p>; }
function Accomplishment({ title, entries, onEditClick }: { title: string; entries: string[]; onEditClick?: () => void }) { return <div className="py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[var(--text)]">{title}</p><button type="button" onClick={onEditClick} className="text-xs font-semibold text-[var(--primary)]">{entries.length ? "Edit" : "Add"}</button></div>{entries.length ? <div className="mt-2 space-y-1">{entries.map((entry) => <p key={entry} className="text-xs text-[var(--text-2)]">{entry}</p>)}</div> : <p className="mt-1 text-xs text-[var(--text-3)]">Add relevant {title.toLowerCase()}.</p>}</div>; }
function ExperiencePanel({ id, title, entries, empty, onEditClick }: { id: string; title: string; entries: ParsedResumeData["workHistory"]; empty: string; onEditClick?: () => void }) { return <Panel id={id} icon={<BriefcaseBusiness />} title={title} onEditClick={onEditClick} add>{entries.length ? <div className="space-y-4">{entries.map((entry, index) => <div key={index} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0"><p className="text-sm font-semibold text-[var(--text)]">{entry.title}</p><p className="text-xs text-[var(--text-2)]">{entry.company}{entry.location ? ` · ${entry.location}` : ""}</p><p className="mt-1 text-xs text-[var(--text-3)]">{entry.period.start} – {entry.period.isCurrent ? "Present" : entry.period.end ?? ""}</p></div>)}</div> : <Empty text={empty} />}</Panel>; }
