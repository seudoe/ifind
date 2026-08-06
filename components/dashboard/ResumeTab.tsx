"use client";

import { useState, useRef } from "react";
import {
  Upload, FileText, RefreshCw, Sparkles,
  CheckCircle, AlertCircle, Trash2, Download, ExternalLink,
  Briefcase, GraduationCap, Code, Award, Globe, BookOpen,
  Users, Trophy, Heart, MapPin, Link as LinkIcon, Loader2, DatabaseZap, X,
  ArrowLeftRight, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { User, ParsedResumeData } from "@/types";

interface ResumeTabProps {
  user: User;
  onResumeUpdate?: () => void;
}

type UploadPhase = "idle" | "uploading" | "extracting";

export function ResumeTab({ user, onResumeUpdate }: ResumeTabProps) {
  const [dragging, setDragging]           = useState(false);
  const [uploadPhase, setUploadPhase]     = useState<UploadPhase>("idle");
  const [deleting, setDeleting]           = useState(false);
  const [reextracting, setReextracting]   = useState(false);
  const [applying, setApplying]           = useState(false);
  const [pendingData, setPendingData]     = useState<ParsedResumeData | null>(null);
  const [oldData, setOldData]             = useState<ParsedResumeData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [localResume, setLocalResume]     = useState(user.resume);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasResume       = Boolean(localResume?.driveViewLink);
  const isUploading     = uploadPhase !== "idle";
  const hasExistingData = Boolean(localResume?.parsedData);
  const isComparing     = Boolean(pendingData && oldData);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB.");
      return;
    }

    setUploadPhase("uploading");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const switchTimer = setTimeout(() => setUploadPhase("extracting"), 800);

      const res = await fetch("/api/user/resume/upload-temp", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      clearTimeout(switchTimer);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      const { pendingParsedData, existingParsedData, autoCommitted, pendingViewLink } = json.data;

      if (autoCommitted) {
        setLocalResume({
          ...localResume,
          driveFileId: json.data.pendingFileId,
          driveViewLink: pendingViewLink,
          uploadedAt: new Date().toISOString(),
          parsedData: pendingParsedData,
        });
        toast.success("Resume uploaded & parsed successfully!");
        onResumeUpdate?.();
      } else if (existingParsedData) {
        setOldData(existingParsedData);
        setPendingData(pendingParsedData);
      } else {
        await commitPending(pendingParsedData, pendingViewLink);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const commitPending = async (parsedData?: ParsedResumeData, viewLink?: string) => {
    setApplying(true);
    try {
      const res = await fetch("/api/user/resume/commit", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Commit failed");

      setLocalResume({
        ...localResume,
        driveFileId: json.data.driveFileId,
        driveViewLink: json.data.driveViewLink ?? viewLink,
        uploadedAt: json.data.uploadedAt,
        parsedData: json.data.parsedData ?? parsedData ?? null,
      });
      setPendingData(null);
      setOldData(null);
      setShowConfirmModal(false);
      toast.success("Resume updated!");
      onResumeUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save resume");
    } finally {
      setApplying(false);
    }
  };

  const downloadJson = (data: ParsedResumeData, label: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${label}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDiscardNew = async () => {
    try {
      await fetch("/api/user/resume/discard-temp", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Non-critical cleanup
    }
    setPendingData(null);
    setOldData(null);
    setShowConfirmModal(false);
    toast.info("Kept existing resume data.");
  };

  const handleDelete = async () => {
    if (!confirm("Remove your resume? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/user/resume", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setLocalResume({ driveFileId: null, driveViewLink: null, uploadedAt: null, parsedData: null });
      setPendingData(null);
      setOldData(null);
      toast.success("Resume removed.");
      onResumeUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete resume");
    } finally {
      setDeleting(false);
    }
  };

  const handleReextract = async () => {
    if (!localResume?.driveViewLink) return;
    setReextracting(true);
    try {
      const res = await fetch("/api/user/resume/reextract", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Re-extraction failed");
      }
      const extracted: ParsedResumeData = json.data;
      if (hasExistingData && localResume?.parsedData) {
        setOldData(localResume.parsedData);
        setPendingData(extracted);
      } else {
        setLocalResume({ ...localResume, parsedData: extracted });
        toast.success("Resume re-extracted successfully!");
        onResumeUpdate?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-extraction failed");
    } finally {
      setReextracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Resume</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload your resume in PDF format. Stored securely on ImageKit & parsed with AI.
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && pendingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">This action is irreversible</h3>
                <p className="text-xs text-gray-500 mt-0.5">Your existing resume data will be permanently replaced</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 space-y-1">
              <p className="font-medium">⚠️ Once replaced, the old data cannot be recovered.</p>
              <p>Make sure you have reviewed both versions in the comparison below before confirming.</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmModal(false)} disabled={applying}>
                Go back
              </Button>
              <Button size="sm" loading={applying} onClick={() => commitPending()} className="bg-red-600 hover:bg-red-700 text-white border-red-600">
                Yes, replace permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {!isComparing && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileRef.current?.click()}
          className={[
            "relative border-2 border-dashed rounded-xl p-10 text-center transition-all",
            isUploading ? "pointer-events-none opacity-70 cursor-default" : "cursor-pointer",
            dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
          ].join(" ")}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {uploadPhase === "uploading" && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600 animate-bounce" />
              </div>
              <p className="text-sm font-medium text-blue-600">Uploading resume to ImageKit…</p>
              <p className="text-xs text-gray-400">Saving your file</p>
            </div>
          )}

          {uploadPhase === "extracting" && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-indigo-600">Extracting data from resume with AI…</p>
              <p className="text-xs text-gray-400">HuggingFace → OpenAI → Gemini Pipeline</p>
            </div>
          )}

          {uploadPhase === "idle" && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {hasResume ? "Drop a new PDF to replace your resume" : "Drag & drop your resume here"}
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — PDF only, max 5MB</p>
              </div>
              <Button variant="outline" size="sm" type="button">
                {hasResume ? "Replace Resume" : "Choose File"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Side-by-side Comparison View */}
      {isComparing && pendingData && oldData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <ArrowLeftRight className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">New data extracted — review before applying</p>
              <p className="text-xs text-amber-700 mt-0.5">Compare your existing data (left) with newly extracted data (right).</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={() => setShowConfirmModal(true)} disabled={applying} className="bg-green-600 hover:bg-green-700 text-white border-green-600">
              <DatabaseZap className="h-3.5 w-3.5 mr-1.5" />
              Apply new data
            </Button>
            <Button variant="outline" size="sm" onClick={handleDiscardNew} disabled={applying}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Keep existing data
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => downloadJson(oldData, "current")}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg"
              >
                <Download className="h-3 w-3" />
                Current JSON
              </button>
              <button
                onClick={() => downloadJson(pendingData, "new")}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium transition-colors bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg"
              >
                <Download className="h-3 w-3" />
                New JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current data</span>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
                <ResumeDataDisplay data={oldData} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">New data</span>
                <Badge variant="secondary" className="text-xs ml-1">AI</Badge>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4 space-y-4">
                <ResumeDataDisplay data={pendingData} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Resume Preview Card */}
      {hasResume && !isComparing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Resume.pdf</p>
                <p className="text-xs text-gray-500">
                  Uploaded {formatDate(localResume.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {uploadPhase === "extracting" ? (
                <>
                  <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                  <span className="text-xs text-indigo-600 font-medium">Extracting data…</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">Stored on ImageKit</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50" style={{ height: 480 }}>
            <iframe
              src={localResume.driveViewLink!}
              className="w-full h-full"
              title="Resume Preview"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={localResume.driveViewLink!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Open PDF
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleReextract}
              loading={reextracting}
              disabled={reextracting || isUploading}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {reextracting ? "Extracting…" : "Re-extract Data"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-red-600 hover:text-red-700 ml-auto"
              loading={deleting}
              disabled={isUploading}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        !isUploading && !isComparing && (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No resume uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload your resume to improve your profile score and enable skill extraction.
            </p>
          </div>
        )
      )}

      {/* Extracted Data View */}
      {!isComparing && localResume?.parsedData ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Extracted Resume Data</h3>
              <Badge variant="secondary" className="text-xs">AI</Badge>
            </div>
          </div>
          <ResumeDataDisplay data={localResume.parsedData} />
        </div>
      ) : !isComparing && hasResume && uploadPhase === "idle" && (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No data extracted yet.</p>
          <p className="text-xs text-gray-400 mt-1 mb-3">
            Click "Re-extract Data" to extract information from your resume.
          </p>
          <Button variant="outline" size="sm" onClick={handleReextract} loading={reextracting}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Extract Data
          </Button>
        </div>
      )}
    </div>
  );
}

function ResumeDataDisplay({ data }: { data: ParsedResumeData }) {
  return (
    <div className="space-y-4">
      {data.metaDetails && (
        <Section icon={<MapPin className="h-4 w-4 text-blue-600" />} title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <Field label="Name" value={data.metaDetails.name} />
            <Field label="Email" value={data.metaDetails.email} />
            {data.metaDetails.phone_no && <Field label="Phone" value={data.metaDetails.phone_no} />}
            {data.metaDetails.address && (
              <Field label="Location" value={[data.metaDetails.address.city, data.metaDetails.address.country].filter(Boolean).join(", ")} />
            )}
            {data.metaDetails.github_profile && (
              <div className="flex items-center gap-1">
                <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                <a href={data.metaDetails.github_profile} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">GitHub</a>
              </div>
            )}
            {data.metaDetails.linkedin && (
              <div className="flex items-center gap-1">
                <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                <a href={data.metaDetails.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">LinkedIn</a>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.summary && (
        <Section title="Summary">
          <p className="text-sm text-gray-700">{data.summary}</p>
        </Section>
      )}

      {data.workHistory?.length > 0 && (
        <Section icon={<Briefcase className="h-4 w-4 text-blue-600" />} title="Work History">
          <div className="space-y-4">
            {data.workHistory.map((w, i) => (
              <div key={i} className="border-l-2 border-blue-200 pl-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{w.title}</p>
                    <p className="text-xs text-gray-600">{w.company} · {w.location}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{w.type}</Badge>
                </div>
                <p className="text-xs text-gray-500">{w.period?.start} – {w.period?.isCurrent ? "Present" : w.period?.end ?? "N/A"}</p>
                {w.responsibilities?.length > 0 && <BulletList label="Responsibilities" items={w.responsibilities} />}
                {w.achievements?.length > 0 && <BulletList label="Achievements" items={w.achievements} />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.education?.length > 0 && (
        <Section icon={<GraduationCap className="h-4 w-4 text-blue-600" />} title="Education">
          <div className="space-y-3">
            {data.education.map((e, i) => (
              <div key={i} className="border-l-2 border-green-200 pl-3 space-y-0.5">
                <p className="font-medium text-sm text-gray-900">{e.institution}</p>
                <p className="text-xs text-gray-600">{e.field?.type} in {e.field?.course}</p>
                <p className="text-xs text-gray-500">{e.period?.start} – {e.period?.isCurrent ? "Present" : e.period?.end ?? "N/A"}</p>
                {e.output && <p className="text-xs text-gray-600">{e.output}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.skills?.length > 0 && (
        <Section icon={<Code className="h-4 w-4 text-blue-600" />} title="Skills">
          <div className="space-y-3">
            {data.skills.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{s.field}</p>
                  {s.yearsOfExperience ? <span className="text-xs text-gray-500">{s.yearsOfExperience} yrs</span> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.tools?.map((t, j) => (
                    <Badge key={j} variant="secondary" className="text-xs">
                      {t.name}{t.score ? ` (${t.score}%)` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.projects?.length > 0 && (
        <Section icon={<Code className="h-4 w-4 text-blue-600" />} title="Projects">
          <div className="space-y-4">
            {data.projects.map((p, i) => (
              <div key={i} className="border-l-2 border-purple-200 pl-3 space-y-1.5">
                <p className="font-medium text-sm text-gray-900">{p.title}</p>
                {p.role && <p className="text-xs text-gray-600">{p.role}</p>}
                {p.problemStatement && <p className="text-xs text-gray-600 italic">{p.problemStatement}</p>}
                {p.techStack?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.techStack.map((t, j) => <Badge key={j} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                )}
                {p.description?.length > 0 && <BulletList items={p.description} />}
                {p.links && (
                  <div className="flex gap-3 text-xs">
                    {p.links.repo && <a href={p.links.repo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Repo</a>}
                    {p.links.live && <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Live</a>}
                    {p.links.demo && <a href={p.links.demo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Demo</a>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.certifications?.length > 0 && (
        <Section icon={<Award className="h-4 w-4 text-blue-600" />} title="Certifications">
          <div className="space-y-2">
            {data.certifications.map((c, i) => (
              <div key={i} className="flex justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-600">{c.issuer}</p>
                  {c.skillsEarned?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.skillsEarned.map((s, j) => <Badge key={j} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">{c.date}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.languages?.length > 0 && (
        <Section icon={<Globe className="h-4 w-4 text-blue-600" />} title="Languages">
          <div className="flex flex-wrap gap-2">
            {data.languages.map((l, i) => (
              <Badge key={i} variant="secondary">{l.lang} – {l.proficiency}{l.score ? ` (${l.score})` : ""}</Badge>
            ))}
          </div>
        </Section>
      )}

      {data.publications?.length > 0 && (
        <Section icon={<BookOpen className="h-4 w-4 text-blue-600" />} title="Publications">
          <div className="space-y-2">
            {data.publications.map((p, i) => (
              <div key={i}>
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">{p.title}</a>
                <p className="text-xs text-gray-600">{p.platform} · {p.type} · {p.date}</p>
                {p.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.keywords.map((k, j) => <Badge key={j} variant="secondary" className="text-xs">{k}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.awards?.length > 0 && (
        <Section icon={<Trophy className="h-4 w-4 text-blue-600" />} title="Awards">
          <div className="space-y-2">
            {data.awards.map((a, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-gray-900">{a.name}</p>
                <p className="text-xs text-gray-600">{a.issuingBody} · {a.date}</p>
                {a.justification && <p className="text-xs text-gray-600 mt-0.5">{a.justification}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.affiliations?.length > 0 && (
        <Section icon={<Users className="h-4 w-4 text-blue-600" />} title="Affiliations">
          <div className="space-y-3">
            {data.affiliations.map((a, i) => (
              <div key={i} className="border-l-2 border-orange-200 pl-3 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.organization}</p>
                    <p className="text-xs text-gray-600">{a.role} · {a.type}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{a.period?.start} – {a.period?.isCurrent ? "Present" : a.period?.end ?? "N/A"}</span>
                </div>
                {a.impact?.length > 0 && <BulletList items={a.impact} />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.interests?.length > 0 && (
        <Section icon={<Heart className="h-4 w-4 text-blue-600" />} title="Interests">
          <div className="space-y-2">
            {data.interests.map((it, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-gray-900">{it.activity}</p>
                <p className="text-xs text-gray-600">{it.description}</p>
                {it.commitmentMetric && <p className="text-xs text-gray-500">{it.commitmentMetric}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-4 space-y-3 border border-gray-100 shadow-sm">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
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
      <span className="text-gray-500 text-sm">{label}: </span>
      <span className="font-medium text-sm text-gray-900">{value}</span>
    </div>
  );
}

function BulletList({ label, items }: { label?: string; items: string[] }) {
  return (
    <div>
      {label && <p className="text-xs font-medium text-gray-700 mb-0.5">{label}:</p>}
      <ul className="list-disc list-inside space-y-0.5">
        {items.map((item, i) => <li key={i} className="text-xs text-gray-600">{item}</li>)}
      </ul>
    </div>
  );
}
