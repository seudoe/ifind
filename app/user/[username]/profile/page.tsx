"use client";

import { useState, useEffect, useRef } from "react";
import {
  Award, BookOpen, BriefcaseBusiness, Building2, CalendarDays, Edit3, FileText,
  GraduationCap, Link2, Mail, MapPin, Phone, Sparkles, UserRound, Users, X, Trash2, Plus, Upload, Camera
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import type { ParsedResumeData, User, Skill } from "@/types";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_LINKS = [
  ["preferences", "Preference"], ["education", "Education"], ["skills", "Key skills"],
  ["languages", "Languages"], ["internships", "Internships"], ["projects", "Projects"],
  ["summary", "Profile summary"], ["accomplishments", "Accomplishments"],
  ["employment", "Employment"], ["resume", "Resume"],
] as const;

function emptyResume(user: User): ParsedResumeData {
  return {
    summary: "",
    metaDetails: { name: user.name, phone_no: user.phone ?? "", gender: null, email: user.email, github_profile: null, linkedin: null, address: { city: user.city ?? "", state: user.state ?? "", country: user.country ?? "", postal_code: "" }, extra_links: [] },
    workHistory: [], education: [], skills: [], projects: [], certifications: [], languages: [], publications: [], affiliations: [], awards: [], interests: [],
    bert_vector: null, tfidf__vector: null,
  };
}

export type EditSection = "personal" | "preferences" | "education" | "skills" | "languages" | "internships" | "projects" | "summary" | "accomplishments" | "employment";

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
    <DashboardShell activeTab="profile" user={user}>
      <div className="space-y-5">
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
            <nav className="grid grid-cols-2 gap-x-3 gap-y-1 lg:block">
              {QUICK_LINKS.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded-[var(--radius-sm)] px-2 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)]">{label}</a>)}
            </nav>
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
                          {project.description.map((desc, i) => (
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
                            <a href={project.links.repo} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
                              <Link2 className="h-3 w-3" /> Repository
                            </a>
                          )}
                          {project.links.live && (
                            <a href={project.links.live} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
                              <Link2 className="h-3 w-3" /> Live Demo
                            </a>
                          )}
                          {project.links.demo && (
                            <a href={project.links.demo} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-medium">
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
    </DashboardShell>
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
              <a href={linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#0a66c2] hover:underline">
                <Link2 className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {github && (
              <a href={github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text)] hover:underline">
                <Link2 className="h-3 w-3" /> GitHub
              </a>
            )}
            {extraLinks.map((item, idx) => (
              <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
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
      <div className="rounded-[var(--radius-sm)] bg-[var(--primary-bg)] p-4">
        <p className="text-xs font-semibold text-[var(--text)]">Complete your profile</p>
        <div className="mt-3 space-y-2">
          {missing.length ? missing.map((item) => <div key={item} className="flex items-center justify-between text-xs text-[var(--text-2)]"><span>{item}</span><span className="text-[var(--success)]">+ improve</span></div>) : <p className="text-xs text-[var(--success)]">Your profile is looking complete.</p>}
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

// ── Profile Edit Drawer Slide-over Component ───────────────────────────────
interface ProfileEditDrawerProps {
  user: User;
  section: EditSection;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

function ProfileEditDrawer({ user, section, isOpen, onClose, onSaveSuccess }: ProfileEditDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // --- Dynamic Form States ---
  // Section: personal
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [extraLinks, setExtraLinks] = useState<{ name: string; link: string }[]>([]);

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/user/upload-picture", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Photo upload failed");
      setProfilePicture(json.url);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // Section: preferences
  const [prefCity, setPrefCity] = useState("");
  const [prefState, setPrefState] = useState("");
  const [prefCountry, setPrefCountry] = useState("");

  // Section: education
  const [educationList, setEducationList] = useState<any[]>([]);

  // Section: skills
  const [skillsGroupList, setSkillsGroupList] = useState<Skill[]>([]);

  // Section: languages
  const [languagesList, setLanguagesList] = useState<any[]>([]);

  // Section: internships / employment
  const [internshipsList, setInternshipsList] = useState<any[]>([]);
  const [employmentList, setEmploymentList] = useState<any[]>([]);

  // Section: projects
  const [projectsList, setProjectsList] = useState<any[]>([]);

  // Section: summary
  const [summaryText, setSummaryText] = useState("");

  // Section: accomplishments
  const [certificationsList, setCertificationsList] = useState<any[]>([]);
  const [awardsList, setAwardsList] = useState<any[]>([]);
  const [affiliationsList, setAffiliationsList] = useState<any[]>([]);

  // Sync state with user data on open or section change
  useEffect(() => {
    if (!isOpen) return;

    // Personal details (recruiter-facing metaDetails)
    const meta = user.resume?.parsedData?.metaDetails;
    setName(meta?.name || user.name || "");
    setUsername(user.username || "");
    setEmail(meta?.email || user.email || "");
    setProfilePicture(user.profilePicture || "");
    setPhone(meta?.phone_no || user.phone || "");
    setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split("T")[0] : "");
    setGender(meta?.gender || user.gender || "");
    setCity(meta?.address?.city || user.city || "");
    setState(meta?.address?.state || user.state || "");
    setCountry(meta?.address?.country || user.country || "");
    setGithub(meta?.github_profile || "");
    setLinkedin(meta?.linkedin || "");
    setExtraLinks(meta?.extra_links ? JSON.parse(JSON.stringify(meta.extra_links)) : []);

    // Preferences
    setPrefCity(user.city || "");
    setPrefState(user.state || "");
    setPrefCountry(user.country || "");

    // Arrays/Sub-docs from MongoDB resume data
    const resume = user.resume?.parsedData || emptyResume(user);
    setEducationList(resume.education ? JSON.parse(JSON.stringify(resume.education)) : []);
    setSkillsGroupList(resume.skills ? JSON.parse(JSON.stringify(resume.skills)) : []);
    setLanguagesList(resume.languages ? JSON.parse(JSON.stringify(resume.languages)) : []);
    setInternshipsList(resume.workHistory ? JSON.parse(JSON.stringify(resume.workHistory.filter(w => w.type === "internship"))) : []);
    setEmploymentList(resume.workHistory ? JSON.parse(JSON.stringify(resume.workHistory.filter(w => w.type !== "internship"))) : []);
    setProjectsList(resume.projects ? JSON.parse(JSON.stringify(resume.projects)) : []);
    setSummaryText(resume.summary || "");
    setCertificationsList(resume.certifications ? JSON.parse(JSON.stringify(resume.certifications)) : []);
    setAwardsList(resume.awards ? JSON.parse(JSON.stringify(resume.awards)) : []);
    setAffiliationsList(resume.affiliations ? JSON.parse(JSON.stringify(resume.affiliations)) : []);
  }, [isOpen, section, user]);

  // --- Dynamic array handlers ---
  const handleAddListItem = (type: "education" | "skillsGroup" | "languages" | "internships" | "employment" | "projects" | "certifications" | "awards" | "affiliations") => {
    if (type === "education") {
      setEducationList(prev => [...prev, { institution: "", field: { type: "", course: "" }, period: { start: "", end: "", isCurrent: false }, output: "" }]);
    } else if (type === "skillsGroup") {
      setSkillsGroupList(prev => [...prev, { field: "", yearsOfExperience: 0, lastUsed: "", tools: [] }]);
    } else if (type === "languages") {
      setLanguagesList(prev => [...prev, { lang: "", proficiency: "Conversational", score: "" }]);
    } else if (type === "internships") {
      setInternshipsList(prev => [...prev, { title: "", company: "", location: "", type: "internship", period: { start: "", end: "", isCurrent: false }, responsibilities: [], achievements: [] }]);
    } else if (type === "employment") {
      setEmploymentList(prev => [...prev, { title: "", company: "", location: "", type: "job", period: { start: "", end: "", isCurrent: false }, responsibilities: [], achievements: [] }]);
    } else if (type === "projects") {
      setProjectsList(prev => [...prev, { title: "", role: "", links: { repo: "", live: "", demo: "" }, techStack: [], problemStatement: "", metrics: [], technicalChallenges: [], description: [], architecture: "" }]);
    } else if (type === "certifications") {
      setCertificationsList(prev => [...prev, { name: "", issuer: "", skillsEarned: [], type: "", date: "" }]);
    } else if (type === "awards") {
      setAwardsList(prev => [...prev, { name: "", date: "", issuingBody: "", justification: "" }]);
    } else if (type === "affiliations") {
      setAffiliationsList(prev => [...prev, { organization: "", role: "", type: "", impact: [], period: { start: "", end: "" } }]);
    }
  };

  const handleRemoveListItem = (type: string, index: number) => {
    if (type === "education") setEducationList(prev => prev.filter((_, i) => i !== index));
    else if (type === "skillsGroup") setSkillsGroupList(prev => prev.filter((_, i) => i !== index));
    else if (type === "languages") setLanguagesList(prev => prev.filter((_, i) => i !== index));
    else if (type === "internships") setInternshipsList(prev => prev.filter((_, i) => i !== index));
    else if (type === "employment") setEmploymentList(prev => prev.filter((_, i) => i !== index));
    else if (type === "projects") setProjectsList(prev => prev.filter((_, i) => i !== index));
    else if (type === "certifications") setCertificationsList(prev => prev.filter((_, i) => i !== index));
    else if (type === "awards") setAwardsList(prev => prev.filter((_, i) => i !== index));
    else if (type === "affiliations") setAffiliationsList(prev => prev.filter((_, i) => i !== index));
  };

  // --- Dynamic nesting handlers ---
  const handleAddNestedString = (listType: "internships" | "employment" | "projects" | "affiliations", parentIdx: number, key: "responsibilities" | "achievements" | "description" | "metrics" | "technicalChallenges" | "impact") => {
    const list = listType === "internships" ? internshipsList : listType === "employment" ? employmentList : listType === "projects" ? projectsList : affiliationsList;
    const next = [...list];
    if (!next[parentIdx][key]) next[parentIdx][key] = [];
    next[parentIdx][key].push("");
    if (listType === "internships") setInternshipsList(next);
    else if (listType === "employment") setEmploymentList(next);
    else if (listType === "projects") setProjectsList(next);
    else setAffiliationsList(next);
  };

  const handleNestedStringChange = (listType: "internships" | "employment" | "projects" | "affiliations", parentIdx: number, key: "responsibilities" | "achievements" | "description" | "metrics" | "technicalChallenges" | "impact", childIdx: number, val: string) => {
    const list = listType === "internships" ? internshipsList : listType === "employment" ? employmentList : listType === "projects" ? projectsList : affiliationsList;
    const next = [...list];
    next[parentIdx][key][childIdx] = val;
    if (listType === "internships") setInternshipsList(next);
    else if (listType === "employment") setEmploymentList(next);
    else if (listType === "projects") setProjectsList(next);
    else setAffiliationsList(next);
  };

  const handleRemoveNestedString = (listType: "internships" | "employment" | "projects" | "affiliations", parentIdx: number, key: "responsibilities" | "achievements" | "description" | "metrics" | "technicalChallenges" | "impact", childIdx: number) => {
    const list = listType === "internships" ? internshipsList : listType === "employment" ? employmentList : listType === "projects" ? projectsList : affiliationsList;
    const next = [...list];
    next[parentIdx][key] = next[parentIdx][key].filter((_: any, i: number) => i !== childIdx);
    if (listType === "internships") setInternshipsList(next);
    else if (listType === "employment") setEmploymentList(next);
    else if (listType === "projects") setProjectsList(next);
    else setAffiliationsList(next);
  };

  // --- Dynamic Skills Group Nested Handlers ---
  const handleAddTool = (groupIdx: number) => {
    const next = [...skillsGroupList];
    if (!next[groupIdx].tools) next[groupIdx].tools = [];
    next[groupIdx].tools.push({ name: "", score: null });
    setSkillsGroupList(next);
  };

  const handleRemoveTool = (groupIdx: number, toolIdx: number) => {
    const next = [...skillsGroupList];
    next[groupIdx].tools = next[groupIdx].tools.filter((_, i) => i !== toolIdx);
    setSkillsGroupList(next);
  };

  const handleToolChange = (groupIdx: number, toolIdx: number, key: "name" | "score", val: string) => {
    const next = [...skillsGroupList];
    if (key === "name") {
      next[groupIdx].tools[toolIdx].name = val;
    } else {
      const parsed = parseInt(val, 10);
      next[groupIdx].tools[toolIdx].score = isNaN(parsed) ? null : parsed;
    }
    setSkillsGroupList(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let payload: any = {};

      if (section === "personal") {
        if (!name.trim()) throw new Error("Recruiter-facing Name is required");

        const meta = user.resume?.parsedData?.metaDetails;

        payload = {
          userUpdate: {
            profilePicture: profilePicture.trim() || null,
          },
          resumeUpdate: {
            metaDetails: {
              name: name.trim(),
              email: email.trim(),
              phone_no: phone.trim(),
              gender: (gender as any) || null,
              github_profile: github.trim() || null,
              linkedin: linkedin.trim() || null,
              address: {
                city: city.trim(),
                state: state.trim(),
                country: country.trim(),
                postal_code: meta?.address?.postal_code || "",
              },
              extra_links: extraLinks
                .filter((l) => l.name.trim() || l.link.trim())
                .map((l) => ({ name: l.name.trim(), link: l.link.trim() })),
            }
          }
        };
      } else if (section === "preferences") {
        payload = {
          userUpdate: {
            city: prefCity.trim() || null,
            state: prefState.trim() || null,
            country: prefCountry.trim() || null,
          }
        };
      } else if (section === "education") {
        payload = {
          resumeUpdate: {
            education: educationList.filter(e => e.institution.trim())
          }
        };
      } else if (section === "skills") {
        // Build direct user.skills from all listed tools
        const flatTools = skillsGroupList.flatMap(g => (g.tools || []).map(t => t.name.trim())).filter(Boolean);
        payload = {
          userUpdate: {
            skills: Array.from(new Set(flatTools))
          },
          resumeUpdate: {
            skills: skillsGroupList.filter(s => s.field.trim())
          }
        };
      } else if (section === "languages") {
        payload = {
          resumeUpdate: {
            languages: languagesList.filter(l => l.lang.trim())
          }
        };
      } else if (section === "internships") {
        payload = {
          resumeUpdate: {
            workHistory: [...employmentList, ...internshipsList.filter(i => i.title.trim())]
          }
        };
      } else if (section === "employment") {
        payload = {
          resumeUpdate: {
            workHistory: [...internshipsList, ...employmentList.filter(e => e.title.trim())]
          }
        };
      } else if (section === "projects") {
        payload = {
          resumeUpdate: {
            projects: projectsList.filter(p => p.title.trim())
          }
        };
      } else if (section === "summary") {
        payload = {
          resumeUpdate: {
            summary: summaryText.trim()
          }
        };
      } else if (section === "accomplishments") {
        payload = {
          resumeUpdate: {
            certifications: certificationsList.filter(c => c.name.trim()),
            awards: awardsList.filter(a => a.name.trim()),
            affiliations: affiliationsList.filter(af => af.organization.trim())
          }
        };
      }

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update details");
      toast.success("Profile section updated successfully!");
      onSaveSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile details");
    } finally {
      setSaving(false);
    }
  };

  const getSectionTitle = () => {
    switch (section) {
      case "personal": return "Personal Details";
      case "preferences": return "Career Preferences";
      case "education": return "Academic Education";
      case "skills": return "Key Professional Skills";
      case "languages": return "Spoken Languages";
      case "internships": return "Internships History";
      case "employment": return "Employment History";
      case "projects": return "Key Projects";
      case "summary": return "Profile Summary";
      case "accomplishments": return "Accomplishments & Certificates";
      default: return "Edit Section";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .profile-edit-popup {
          position: fixed;
          z-index: 50;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        @media (min-width: 1024px) {
          .profile-edit-popup {
            left: 50%;
            top: 50%;
            height: 85vh;
            width: 480px;
            border-radius: var(--radius);
            animation: slideToCenter 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        @media (max-width: 1023px) {
          .profile-edit-popup {
            left: 0;
            right: 0;
            top: 0;
            bottom: 49px;
            animation: slideUpMobile 300ms ease-out forwards;
          }
        }
        @keyframes slideToCenter {
          from {
            transform: translate3d(100vw, -50%, 0);
            opacity: 0;
          }
          to {
            transform: translate3d(-50%, -50%, 0);
            opacity: 1;
          }
        }
        @keyframes slideUpMobile {
          from {
            transform: translate3d(0, 100%, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }
      `}} />
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="profile-edit-popup">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">{getSectionTitle()}</h3>
            <p className="text-[10px] text-[var(--text-3)]">Modify current details on your profile</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          
          {/* ── Section: PERSONAL ── */}
          {section === "personal" && (
            <>
              {/* Circular Profile Photo Display & Change/Delete Controls */}
              <FormField label="Profile Picture">
                <div className="flex items-center gap-4 py-2">
                  <div className="relative group shrink-0">
                    {profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profilePicture}
                        alt={name || user.name}
                        className="h-20 w-20 rounded-full object-cover border-2 border-[var(--primary)] shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-[var(--primary)] text-white font-bold text-xl border-2 border-[var(--border)] shadow-sm flex items-center justify-center shrink-0 uppercase select-none">
                        {getInitials(name || user.name) || <UserRound className="h-9 w-9 text-white/90" />}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[var(--primary)] text-white shadow-md hover:scale-105 transition-transform"
                      title="Change photo"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-xs font-medium text-[var(--text)] transition-colors flex items-center gap-1.5 w-fit"
                    >
                      <Camera className="h-3.5 w-3.5 text-[var(--primary)]" />
                      {uploadingPhoto ? "Uploading..." : "Change photo"}
                    </button>
                    {profilePicture && (
                      <button
                        type="button"
                        onClick={() => setProfilePicture("")}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 w-fit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete photo
                      </button>
                    )}
                  </div>
                </div>
              </FormField>

              <FormField label="Recruiter Contact Name" required>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs" />
              </FormField>
              <FormField label="Username" required>
                <input type="text" value={username} disabled className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface-2)] text-[var(--text-3)] outline-none w-full text-xs cursor-not-allowed opacity-75" />
              </FormField>
              <FormField label="Recruiter Contact Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs"
                />
                <p className="text-[10px] text-[var(--text-3)] mt-1">This email will be visible to recruiters on your profile/resume.</p>
              </FormField>
              <FormField label="Recruiter Contact Phone">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs" />
              </FormField>
              <FormField label="Gender">
                <select value={gender} onChange={e => setGender(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </FormField>
              <div className="grid grid-cols-3 gap-2">
                <FormField label="City"><input type="text" value={city} onChange={e => setCity(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" /></FormField>
                <FormField label="State"><input type="text" value={state} onChange={e => setState(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" /></FormField>
                <FormField label="Country"><input type="text" value={country} onChange={e => setCountry(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" /></FormField>
              </div>

              {/* ── Web & Social Links ── */}
              <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text)]">Web & Social Links</p>
                <FormField label="LinkedIn Profile URL">
                  <input
                    type="url"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs"
                  />
                </FormField>

                <FormField label="GitHub Profile URL">
                  <input
                    type="url"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="https://github.com/username"
                    className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all w-full text-xs"
                  />
                </FormField>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[var(--text-2)]">Additional Links (Portfolio, Blog, etc.)</p>
                    <button
                      type="button"
                      onClick={() => setExtraLinks((prev) => [...prev, { name: "", link: "" }])}
                      className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                    >
                      + Add link
                    </button>
                  </div>

                  {extraLinks.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const next = [...extraLinks];
                          next[idx].name = e.target.value;
                          setExtraLinks(next);
                        }}
                        placeholder="Link Name (e.g. Portfolio)"
                        className="px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-1/3 text-xs"
                      />
                      <input
                        type="url"
                        value={item.link}
                        onChange={(e) => {
                          const next = [...extraLinks];
                          next[idx].link = e.target.value;
                          setExtraLinks(next);
                        }}
                        placeholder="https://..."
                        className="px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-2/3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setExtraLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Section: PREFERENCES ── */}
          {section === "preferences" && (
            <>
              <FormField label="Preferred City">
                <input type="text" value={prefCity} onChange={e => setPrefCity(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] w-full text-xs" placeholder="e.g. Bangalore" />
              </FormField>
              <FormField label="Preferred State">
                <input type="text" value={prefState} onChange={e => setPrefState(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] w-full text-xs" placeholder="e.g. Karnataka" />
              </FormField>
              <FormField label="Preferred Country">
                <input type="text" value={prefCountry} onChange={e => setPrefCountry(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--primary)] w-full text-xs" placeholder="e.g. India" />
              </FormField>
            </>
          )}

          {/* ── Section: EDUCATION ── */}
          {section === "education" && (
            <div className="space-y-4">
              {educationList.map((edu, idx) => (
                <div key={idx} className="plasma-card p-4 space-y-3 relative border border-[var(--border)] rounded">
                  <button type="button" onClick={() => handleRemoveListItem("education", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <h4 className="font-semibold text-xs text-[var(--text)]">Education Entry #{idx + 1}</h4>
                  
                  <FormField label="Institution/School" required>
                    <input type="text" value={edu.institution} onChange={e => {
                      const next = [...educationList];
                      next[idx].institution = e.target.value;
                      setEducationList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Degree Type" required>
                      <input type="text" placeholder="e.g. B.Tech" value={edu.field?.type || ""} onChange={e => {
                        const next = [...educationList];
                        if (!next[idx].field) next[idx].field = {};
                        next[idx].field.type = e.target.value;
                        setEducationList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" />
                    </FormField>
                    <FormField label="Course/Major" required>
                      <input type="text" placeholder="e.g. Computer Science" value={edu.field?.course || ""} onChange={e => {
                        const next = [...educationList];
                        if (!next[idx].field) next[idx].field = {};
                        next[idx].field.course = e.target.value;
                        setEducationList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Start Period">
                      <input type="text" placeholder="e.g. 2022" value={edu.period?.start || ""} onChange={e => {
                        const next = [...educationList];
                        if (!next[idx].period) next[idx].period = {};
                        next[idx].period.start = e.target.value;
                        setEducationList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" />
                    </FormField>
                    <FormField label="End Period">
                      <input type="text" placeholder="e.g. 2026" disabled={edu.period?.isCurrent} value={edu.period?.isCurrent ? "Present" : edu.period?.end || ""} onChange={e => {
                        const next = [...educationList];
                        if (!next[idx].period) next[idx].period = {};
                        next[idx].period.end = e.target.value;
                        setEducationList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs disabled:opacity-60" />
                    </FormField>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`edu-curr-${idx}`} checked={edu.period?.isCurrent || false} onChange={e => {
                      const next = [...educationList];
                      if (!next[idx].period) next[idx].period = {};
                      next[idx].period.isCurrent = e.target.checked;
                      if (e.target.checked) next[idx].period.end = "";
                      setEducationList(next);
                    }} className="h-3.5 w-3.5 border-[var(--border)] rounded text-[var(--primary)]" />
                    <label htmlFor={`edu-curr-${idx}`} className="text-[11px] font-medium text-[var(--text-2)]">Currently pursuing this education</label>
                  </div>

                  <FormField label="Grade / GPA / CGPA">
                    <input type="text" placeholder="e.g. 9.2 CGPA" value={edu.output || ""} onChange={e => {
                      const next = [...educationList];
                      next[idx].output = e.target.value;
                      setEducationList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] outline-none w-full text-xs" />
                  </FormField>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem("education")} className="w-full text-center border border-dashed border-[var(--border)] py-2.5 rounded text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors text-xs">
                + Add Education Entry
              </button>
            </div>
          )}

          {/* ── Section: SKILLS (Groups editor) ── */}
          {section === "skills" && (
            <div className="space-y-5">
              {skillsGroupList.map((group, groupIdx) => (
                <div key={groupIdx} className="plasma-card p-4 space-y-3 relative border border-[var(--border)] rounded bg-[var(--surface-2)]">
                  <button type="button" onClick={() => handleRemoveListItem("skillsGroup", groupIdx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <h4 className="font-semibold text-xs text-[var(--text)]">Skill Group #{groupIdx + 1}</h4>

                  <FormField label="Group Name / Field" required>
                    <input type="text" placeholder="e.g. Frontend or Languages" value={group.field} onChange={e => {
                      const next = [...skillsGroupList];
                      next[groupIdx].field = e.target.value;
                      setSkillsGroupList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Years of Experience">
                      <input type="number" min={0} value={group.yearsOfExperience ?? ""} onChange={e => {
                        const next = [...skillsGroupList];
                        next[groupIdx].yearsOfExperience = parseInt(e.target.value, 10) || 0;
                        setSkillsGroupList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                    </FormField>
                    <FormField label="Last Used Year">
                      <input type="text" placeholder="e.g. 2026" value={group.lastUsed || ""} onChange={e => {
                        const next = [...skillsGroupList];
                        next[groupIdx].lastUsed = e.target.value;
                        setSkillsGroupList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                    </FormField>
                  </div>

                  {/* Nested Tools */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Skills / Tools in this Group</label>
                      <button type="button" onClick={() => handleAddTool(groupIdx)} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Skill Tag
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(group.tools || []).map((tool, toolIdx) => (
                        <div key={toolIdx} className="flex items-center gap-2">
                          <input type="text" placeholder="Skill name" value={tool.name || ""} onChange={e => handleToolChange(groupIdx, toolIdx, "name", e.target.value)} className="flex-1 px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <input type="number" placeholder="Score %" min={0} max={100} value={tool.score === null || tool.score === undefined ? "" : tool.score} onChange={e => handleToolChange(groupIdx, toolIdx, "score", e.target.value)} className="w-16 px-2 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveTool(groupIdx, toolIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem("skillsGroup")} className="w-full text-center border border-dashed border-[var(--border)] py-2.5 rounded text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors text-xs">
                + Add Skill Group
              </button>
            </div>
          )}

          {/* ── Section: LANGUAGES ── */}
          {section === "languages" && (
            <div className="space-y-4">
              {languagesList.map((lang, idx) => (
                <div key={idx} className="flex items-end gap-2 border border-[var(--border)] p-3 rounded relative bg-[var(--surface-2)]">
                  <button type="button" onClick={() => handleRemoveListItem("languages", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-3)]">Language</label>
                    <input type="text" value={lang.lang} onChange={e => {
                      const next = [...languagesList];
                      next[idx].lang = e.target.value;
                      setLanguagesList(next);
                    }} placeholder="e.g. English" className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-3)]">Proficiency</label>
                    <select value={lang.proficiency} onChange={e => {
                      const next = [...languagesList];
                      next[idx].proficiency = e.target.value;
                      setLanguagesList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs">
                      <option value="Basic">Basic</option>
                      <option value="Conversational">Conversational</option>
                      <option value="Fluent">Fluent</option>
                      <option value="Native">Native</option>
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem("languages")} className="w-full text-center border border-dashed border-[var(--border)] py-2 rounded text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors text-xs">
                + Add Language
              </button>
            </div>
          )}

          {/* ── Section: INTERNSHIPS / EMPLOYMENT ── */}
          {(section === "internships" || section === "employment") && (
            <div className="space-y-4">
              {(section === "internships" ? internshipsList : employmentList).map((history, idx) => (
                <div key={idx} className="plasma-card p-4 space-y-3 relative border border-[var(--border)] rounded">
                  <button type="button" onClick={() => handleRemoveListItem(section, idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <FormField label="Job Title" required>
                    <input type="text" value={history.title} onChange={e => {
                      const next = [...(section === "internships" ? internshipsList : employmentList)];
                      next[idx].title = e.target.value;
                      if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <FormField label="Company/Organization" required>
                    <input type="text" value={history.company} onChange={e => {
                      const next = [...(section === "internships" ? internshipsList : employmentList)];
                      next[idx].company = e.target.value;
                      if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <FormField label="Location">
                    <input type="text" placeholder="e.g. Bangalore, India" value={history.location || ""} onChange={e => {
                      const next = [...(section === "internships" ? internshipsList : employmentList)];
                      next[idx].location = e.target.value;
                      if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Start Date">
                      <input type="text" placeholder="e.g. Jan 2024" value={history.period?.start || ""} onChange={e => {
                        const next = [...(section === "internships" ? internshipsList : employmentList)];
                        if (!next[idx].period) next[idx].period = {};
                        next[idx].period.start = e.target.value;
                        if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                    </FormField>
                    <FormField label="End Date">
                      <input type="text" placeholder="e.g. Jun 2024" disabled={history.period?.isCurrent} value={history.period?.isCurrent ? "Present" : history.period?.end || ""} onChange={e => {
                        const next = [...(section === "internships" ? internshipsList : employmentList)];
                        if (!next[idx].period) next[idx].period = {};
                        next[idx].period.end = e.target.value;
                        if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs disabled:opacity-60" />
                    </FormField>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`hist-curr-${idx}`} checked={history.period?.isCurrent || false} onChange={e => {
                      const next = [...(section === "internships" ? internshipsList : employmentList)];
                      if (!next[idx].period) next[idx].period = {};
                      next[idx].period.isCurrent = e.target.checked;
                      if (e.target.checked) next[idx].period.end = "";
                      if (section === "internships") setInternshipsList(next); else setEmploymentList(next);
                    }} className="h-3.5 w-3.5 border-[var(--border)] rounded" />
                    <label htmlFor={`hist-curr-${idx}`} className="text-[11px] font-medium text-[var(--text-2)]">Currently in this role</label>
                  </div>

                  {/* Responsibilities list */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Responsibilities</label>
                      <button type="button" onClick={() => handleAddNestedString(section, idx, "responsibilities")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Responsibility
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(history.responsibilities || []).map((resp: string, rIdx: number) => (
                        <div key={rIdx} className="flex items-center gap-2">
                          <input type="text" value={resp} onChange={e => handleNestedStringChange(section, idx, "responsibilities", rIdx, e.target.value)} className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveNestedString(section, idx, "responsibilities", rIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Achievements list */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Achievements</label>
                      <button type="button" onClick={() => handleAddNestedString(section, idx, "achievements")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Achievement
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(history.achievements || []).map((ach: string, aIdx: number) => (
                        <div key={aIdx} className="flex items-center gap-2">
                          <input type="text" value={ach} onChange={e => handleNestedStringChange(section, idx, "achievements", aIdx, e.target.value)} className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveNestedString(section, idx, "achievements", aIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem(section)} className="w-full text-center border border-dashed border-[var(--border)] py-2.5 rounded text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors text-xs">
                + Add {section === "internships" ? "Internship" : "Employment"} Entry
              </button>
            </div>
          )}

          {/* ── Section: PROJECTS ── */}
          {section === "projects" && (
            <div className="space-y-4">
              {projectsList.map((project, idx) => (
                <div key={idx} className="plasma-card p-4 space-y-3 relative border border-[var(--border)] rounded">
                  <button type="button" onClick={() => handleRemoveListItem("projects", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <FormField label="Project Title" required>
                    <input type="text" value={project.title} onChange={e => {
                      const next = [...projectsList];
                      next[idx].title = e.target.value;
                      setProjectsList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <FormField label="Your Role">
                    <input type="text" placeholder="e.g. Lead Developer" value={project.role || ""} onChange={e => {
                      const next = [...projectsList];
                      next[idx].role = e.target.value;
                      setProjectsList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <FormField label="Tech Stack (comma separated)">
                    <input type="text" placeholder="e.g. React, Node.js, MongoDB" value={Array.isArray(project.techStack) ? project.techStack.join(", ") : ""} onChange={e => {
                      const next = [...projectsList];
                      next[idx].techStack = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                      setProjectsList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs" />
                  </FormField>

                  <div className="grid grid-cols-3 gap-2">
                    <FormField label="Repo URL">
                      <input type="url" value={project.links?.repo || ""} onChange={e => {
                        const next = [...projectsList];
                        if (!next[idx].links) next[idx].links = {};
                        next[idx].links.repo = e.target.value;
                        setProjectsList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                    </FormField>
                    <FormField label="Live URL">
                      <input type="url" value={project.links?.live || ""} onChange={e => {
                        const next = [...projectsList];
                        if (!next[idx].links) next[idx].links = {};
                        next[idx].links.live = e.target.value;
                        setProjectsList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-xs" />
                    </FormField>
                    <FormField label="Demo URL">
                      <input type="url" value={project.links?.demo || ""} onChange={e => {
                        const next = [...projectsList];
                        if (!next[idx].links) next[idx].links = {};
                        next[idx].links.demo = e.target.value;
                        setProjectsList(next);
                      }} className="px-3 py-2 border border-[var(--border)] rounded bg-xs" />
                    </FormField>
                  </div>

                  <FormField label="Problem Statement">
                    <input type="text" value={project.problemStatement || ""} onChange={e => {
                      const next = [...projectsList];
                      next[idx].problemStatement = e.target.value || null;
                      setProjectsList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs w-full" />
                  </FormField>

                  <FormField label="Architecture">
                    <input type="text" value={project.architecture || ""} onChange={e => {
                      const next = [...projectsList];
                      next[idx].architecture = e.target.value;
                      setProjectsList(next);
                    }} className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs w-full" />
                  </FormField>

                  {/* Project description list */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Project Description Lines</label>
                      <button type="button" onClick={() => handleAddNestedString("projects", idx, "description")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Line
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(project.description || []).map((desc: string, dIdx: number) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <input type="text" value={desc} onChange={e => handleNestedStringChange("projects", idx, "description", dIdx, e.target.value)} className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveNestedString("projects", idx, "description", dIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project metrics list */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Impact & Metrics</label>
                      <button type="button" onClick={() => handleAddNestedString("projects", idx, "metrics")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Metric
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(project.metrics || []).map((metric: string, mIdx: number) => (
                        <div key={mIdx} className="flex items-center gap-2">
                          <input type="text" value={metric} onChange={e => handleNestedStringChange("projects", idx, "metrics", mIdx, e.target.value)} className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveNestedString("projects", idx, "metrics", mIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project technical challenges list */}
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Technical Challenges</label>
                      <button type="button" onClick={() => handleAddNestedString("projects", idx, "technicalChallenges")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                        <Plus className="h-3 w-3" /> Add Challenge
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(project.technicalChallenges || []).map((challenge: string, tcIdx: number) => (
                        <div key={tcIdx} className="flex items-center gap-2">
                          <input type="text" value={challenge} onChange={e => handleNestedStringChange("projects", idx, "technicalChallenges", tcIdx, e.target.value)} className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                          <button type="button" onClick={() => handleRemoveNestedString("projects", idx, "technicalChallenges", tcIdx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem("projects")} className="w-full text-center border border-dashed border-[var(--border)] py-2.5 rounded text-[var(--primary)] font-semibold hover:bg-[var(--primary-bg)] transition-colors text-xs">
                + Add Project Entry
              </button>
            </div>
          )}

          {/* ── Section: SUMMARY ── */}
          {section === "summary" && (
            <FormField label="Profile Summary" required>
              <textarea
                rows={6}
                value={summaryText}
                onChange={e => setSummaryText(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] w-full text-xs outline-none focus:border-[var(--primary)] transition-all resize-y leading-relaxed"
                placeholder="Highlight your academic achievements, internship preferences, and target jobs..."
              />
            </FormField>
          )}

          {/* ── Section: ACCOMPLISHMENTS ── */}
          {section === "accomplishments" && (
            <div className="space-y-6">
              
              {/* Sub-section: Certifications */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[var(--text)] border-b border-[var(--border)] pb-1.5">Certifications</label>
                {certificationsList.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2 border border-[var(--border)] p-3 rounded relative bg-[var(--surface-2)]">
                    <button type="button" onClick={() => handleRemoveListItem("certifications", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Certificate Name" value={cert.name} onChange={e => {
                        const next = [...certificationsList];
                        next[idx].name = e.target.value;
                        setCertificationsList(next);
                      }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                      <input type="text" placeholder="Issuer" value={cert.issuer || ""} onChange={e => {
                        const next = [...certificationsList];
                        next[idx].issuer = e.target.value;
                        setCertificationsList(next);
                      }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                      <input type="text" placeholder="Type (e.g. Professional)" value={cert.type || ""} onChange={e => {
                        const next = [...certificationsList];
                        next[idx].type = e.target.value;
                        setCertificationsList(next);
                      }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                      <input type="text" placeholder="Skills Earned (comma separated)" value={Array.isArray(cert.skillsEarned) ? cert.skillsEarned.join(", ") : ""} onChange={e => {
                        const next = [...certificationsList];
                        next[idx].skillsEarned = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                        setCertificationsList(next);
                      }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                      <input type="text" placeholder="Date (e.g. Aug 2026)" value={cert.date || ""} onChange={e => {
                        const next = [...certificationsList];
                        next[idx].date = e.target.value;
                        setCertificationsList(next);
                      }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => handleAddListItem("certifications")} className="w-full text-center border border-dashed border-[var(--border)] py-1.5 rounded text-[var(--primary)] font-semibold text-xs">
                  + Add Certification
                </button>
              </div>

              {/* Sub-section: Awards */}
              <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                <label className="block text-xs font-bold text-[var(--text)] border-b border-[var(--border)] pb-1.5">Awards & Achievements</label>
                {awardsList.map((award, idx) => (
                  <div key={idx} className="border border-[var(--border)] p-3 rounded relative bg-[var(--surface-2)] space-y-2">
                    <button type="button" onClick={() => handleRemoveListItem("awards", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <input type="text" placeholder="Award description" value={award.name} onChange={e => {
                      const next = [...awardsList];
                      next[idx].name = e.target.value;
                      setAwardsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    <input type="text" placeholder="Issuing Body" value={award.issuingBody || ""} onChange={e => {
                      const next = [...awardsList];
                      next[idx].issuingBody = e.target.value;
                      setAwardsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    <input type="text" placeholder="Justification / Criteria" value={award.justification || ""} onChange={e => {
                      const next = [...awardsList];
                      next[idx].justification = e.target.value;
                      setAwardsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    <input type="text" placeholder="Date Awarded" value={award.date || ""} onChange={e => {
                      const next = [...awardsList];
                      next[idx].date = e.target.value;
                      setAwardsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                  </div>
                ))}
                <button type="button" onClick={() => handleAddListItem("awards")} className="w-full text-center border border-dashed border-[var(--border)] py-1.5 rounded text-[var(--primary)] font-semibold text-xs">
                  + Add Award
                </button>
              </div>

              {/* Sub-section: Affiliations */}
              <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                <label className="block text-xs font-bold text-[var(--text)] border-b border-[var(--border)] pb-1.5">Clubs & Committees</label>
                {affiliationsList.map((aff, idx) => (
                  <div key={idx} className="border border-[var(--border)] p-3 rounded relative bg-[var(--surface-2)] space-y-2">
                    <button type="button" onClick={() => handleRemoveListItem("affiliations", idx)} className="absolute top-2.5 right-2.5 p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <input type="text" placeholder="Organization/Club name" value={aff.organization} onChange={e => {
                      const next = [...affiliationsList];
                      next[idx].organization = e.target.value;
                      setAffiliationsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    <input type="text" placeholder="Your Role (e.g. Secretary)" value={aff.role || ""} onChange={e => {
                      const next = [...affiliationsList];
                      next[idx].role = e.target.value;
                      setAffiliationsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    <input type="text" placeholder="Type (e.g. Academic / Athletic)" value={aff.type || ""} onChange={e => {
                      const next = [...affiliationsList];
                      next[idx].type = e.target.value;
                      setAffiliationsList(next);
                    }} className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] w-full text-xs" />
                    
                    {/* Nested Impact List */}
                    <div className="space-y-2 border-t border-[var(--border)] pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Key Impact Lines</label>
                        <button type="button" onClick={() => handleAddNestedString("affiliations", idx, "impact")} className="text-[10px] text-[var(--primary)] font-semibold inline-flex items-center gap-0.5 hover:underline">
                          <Plus className="h-3 w-3" /> Add Impact Line
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(aff.impact || []).map((imp: string, impIdx: number) => (
                          <div key={impIdx} className="flex items-center gap-2">
                            <input type="text" value={imp} onChange={e => handleNestedStringChange("affiliations", idx, "impact", impIdx, e.target.value)} className="flex-1 px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-xs" />
                            <button type="button" onClick={() => handleRemoveNestedString("affiliations", idx, "impact", impIdx)} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => handleAddListItem("affiliations")} className="w-full text-center border border-dashed border-[var(--border)] py-1.5 rounded text-[var(--primary)] font-semibold text-xs">
                  + Add Affiliation
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions at the bottomest row */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[var(--text-2)]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
