"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    Upload,
    FileText,
    RefreshCw,
    Sparkles,
    CheckCircle,
    AlertCircle,
    Trash2,
    Download,
    ExternalLink,
    Loader2,
    DatabaseZap,
    X,
    ArrowLeftRight,
    ShieldAlert,
    BadgeCheck,
    Link2,
    Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { CreditsBadge, refreshCredits } from "./CreditsBadge";
import { AnalysisSection } from "./resume/AnalysisSection";
import type { AnalysisData, ExtractedSkill } from "./resume/types";
import { ResumeParsedViewer } from "./resume/ResumeParsedViewer";
import type { User, ParsedResumeData } from "@/types";

interface ResumeTabProps {
    user: User;
    onResumeUpdate?: () => void;
}

type UploadPhase = "idle" | "uploading" | "extracting";


export function ResumeTab({ user, onResumeUpdate }: ResumeTabProps) {
    const params = useParams();
    const username = (params?.username as string) ?? user.username;
    const [dragging, setDragging] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
    const [deleting, setDeleting] = useState(false);
    const [reextracting, setReextracting] = useState(false);
    const [applying, setApplying] = useState(false);
    const [pendingData, setPendingData] = useState<ParsedResumeData | null>(
        null,
    );
    const [oldData, setOldData] = useState<ParsedResumeData | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [localResume, setLocalResume] = useState(user.resume);
    const fileRef = useRef<HTMLInputElement>(null);

    // Analysis states
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
    const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<"overview" | "details">("overview");

    const hasResume = Boolean(localResume?.driveViewLink);
    const isUploading = uploadPhase !== "idle";
    const hasExistingData = Boolean(localResume?.parsedData);
    const isComparing = Boolean(pendingData && oldData);

    // ── Quota & LinkedIn state ──────────────────────────────────────────────
    const isLinkedInVerified = user.linkedinDetails?.email_verified === true;
    const isLinkedInConnected = Boolean(
        user.linkedinId || user.linkedinDetails,
    );
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const aiUsedThisMonth =
        user.aiExtractionMonthYear === currentMonth
            ? (user.aiExtractionUsedThisMonth ?? 0)
            : 0;
    const AI_LIMIT = 3;
    const aiRemaining = Math.max(0, AI_LIMIT - aiUsedThisMonth);

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

            const switchTimer = setTimeout(
                () => setUploadPhase("extracting"),
                800,
            );

            const res = await fetch("/api/user/resume/upload-temp", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            clearTimeout(switchTimer);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Upload failed");

            const {
                pendingParsedData,
                existingParsedData,
                autoCommitted,
                pendingViewLink,
            } = json.data;

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

    const commitPending = async (
        parsedData?: ParsedResumeData,
        viewLink?: string,
    ) => {
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
            toast.error(
                err instanceof Error ? err.message : "Failed to save resume",
            );
        } finally {
            setApplying(false);
        }
    };

    const downloadJson = (data: ParsedResumeData, label: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
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
            setLocalResume({
                driveFileId: null,
                driveViewLink: null,
                uploadedAt: null,
                parsedData: null,
            });
            setPendingData(null);
            setOldData(null);
            toast.success("Resume removed.");
            onResumeUpdate?.();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to delete resume",
            );
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
            toast.error(
                err instanceof Error ? err.message : "Re-extraction failed",
            );
        } finally {
            setReextracting(false);
            refreshCredits();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    // ── Analysis Functions ──────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!localResume?.parsedData) {
            toast.error("Please upload and extract resume data first");
            return;
        }

        setAnalyzing(true);
        try {
            const res = await fetch("/api/user/resume/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Analysis failed");

            setAnalysis(json.analysis);
            setExtractedSkills(json.extractedSkills || []);
            toast.success("Resume analysis completed!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setAnalyzing(false);
            refreshCredits();
        }
    };

    const fetchExistingAnalysis = async () => {
        if (!hasResume || !localResume?.parsedData) return;

        setLoadingAnalysis(true);
        try {
            const res = await fetch("/api/user/resume/analyze", {
                method: "GET",
                credentials: "include",
            });

            if (res.ok) {
                const json = await res.json();
                setAnalysis(json.analysis);
                setExtractedSkills(json.extractedSkills || []);
            }
        } catch (err) {
            // Silently fail - analysis may not exist yet
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // Fetch existing analysis on mount
    useState(() => {
        fetchExistingAnalysis();
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold text-[var(--text)]">Resume Analyzer</h2>
                <CreditsBadge className="mt-2" />
                <p className="text-base text-[var(--text-3)] mt-1">
                    Upload your resume, extract data with AI, and get comprehensive analysis with ATS scoring.
                </p>
            </div>

            {/* ── Extractor Plan Banner ─────────────────────────────────── */}
            {isLinkedInVerified ? (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-[var(--primary-bg)] px-4 py-3">
                    <BadgeCheck className="h-5 w-5 text-[var(--primary-dk)] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-blue-900">
                            LinkedIn Verified — Best extractor available
                        </p>
                        <p className="text-xs text-[var(--primary-dk)]">
                            You can use the high-accuracy AI extractor{" "}
                            <span className="font-medium">
                                {aiRemaining} of {AI_LIMIT} times
                            </span>{" "}
                            this month, plus unlimited low-accuracy extractions.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                    <Link2 className="h-5 w-5 text-[var(--text-3)] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-[var(--text)]">
                            Low-accuracy extractor (unlimited)
                        </p>
                        <p className="text-xs text-[var(--text-3)]">
                            {isLinkedInConnected
                                ? "Your LinkedIn account is connected but not verified. Verify it to unlock 3 high-accuracy AI extractions per month."
                                : "Connect and verify your LinkedIn account to unlock 3 high-accuracy AI extractions per month."}
                        </p>
                        {!isLinkedInVerified && (
                            <a
                                href="/api/auth/linkedin"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline mt-0.5"
                            >
                                <BadgeCheck className="h-3.5 w-3.5" />
                                {isLinkedInConnected
                                    ? "Re-connect LinkedIn to verify"
                                    : "Connect LinkedIn"}
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && pendingData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[var(--text)]">
                                    This action is irreversible
                                </h3>
                                <p className="text-xs text-[var(--text-3)] mt-0.5">
                                    Your existing resume data will be
                                    permanently replaced
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 space-y-1">
                            <p className="font-medium">
                                ⚠️ Once replaced, the old data cannot be
                                recovered.
                            </p>
                            <p>
                                Make sure you have reviewed both versions in the
                                comparison below before confirming.
                            </p>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={applying}
                            >
                                Go back
                            </Button>
                            <Button
                                size="sm"
                                loading={applying}
                                onClick={() => commitPending()}
                                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                            >
                                Yes, replace permanently
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Zone */}
            {!isComparing && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && fileRef.current?.click()}
                    className={[
                        "relative border-2 border-dashed rounded-xl p-10 text-center transition-all",
                        isUploading
                            ? "pointer-events-none opacity-70 cursor-default"
                            : "cursor-pointer",
                        dragging
                            ? "border-blue-500 bg-[var(--primary-bg)]"
                            : "border-[var(--border)] hover:border-blue-400 hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                        }}
                    />

                    {uploadPhase === "uploading" && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <Upload className="h-6 w-6 text-[var(--primary-dk)] animate-bounce" />
                            </div>
                            <p className="text-sm font-medium text-[var(--primary-dk)]">
                                Uploading resume to ImageKit…
                            </p>
                            <p className="text-xs text-[var(--text-3)]">
                                Saving your file
                            </p>
                        </div>
                    )}

                    {uploadPhase === "extracting" && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
                            </div>
                            <p className="text-sm font-medium text-indigo-600">
                                Extracting data from resume with AI…
                            </p>
                            <p className="text-xs text-[var(--text-3)]">
                                {isLinkedInVerified && aiRemaining > 0
                                    ? "OpenAI → Gemini (High accuracy)"
                                    : "HuggingFace (Low accuracy)"}
                            </p>
                        </div>
                    )}

                    {uploadPhase === "idle" && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-[var(--surface-3)] flex items-center justify-center">
                                <Upload className="h-6 w-6 text-[var(--text-3)]" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-[var(--text-2)]">
                                    {hasResume
                                        ? "Drop a new PDF to replace your resume"
                                        : "Drag & drop your resume here"}
                                </p>
                                <p className="text-xs text-[var(--text-3)] mt-1">
                                    or click to browse — PDF only, max 5MB
                                </p>
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
                            <p className="text-sm font-semibold text-amber-900">
                                New data extracted — review before applying
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Compare your existing data (left) with newly
                                extracted data (right).
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <Button
                            size="sm"
                            onClick={() => setShowConfirmModal(true)}
                            disabled={applying}
                            className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                        >
                            <DatabaseZap className="h-3.5 w-3.5 mr-1.5" />
                            Apply new data
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDiscardNew}
                            disabled={applying}
                        >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Keep existing data
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                onClick={() => downloadJson(oldData, "current")}
                                className="flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] font-medium transition-colors bg-[var(--surface-3)] hover:bg-gray-200 px-2.5 py-1.5 rounded-lg"
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
                                <span className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide">
                                    Current data
                                </span>
                            </div>
                            <div className="bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-4 space-y-4">
                                <ResumeParsedViewer data={oldData} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                                    New data
                                </span>
                                <Badge
                                    variant="secondary"
                                    className="text-xs ml-1"
                                >
                                    AI
                                </Badge>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4 space-y-4">
                                <ResumeParsedViewer data={pendingData} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Resume Preview Card */}
            {hasResume && !isComparing ? (
                <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <p className="font-medium text-[var(--text)] text-sm">
                                    Resume.pdf
                                </p>
                                <p className="text-xs text-[var(--text-3)]">
                                    Uploaded{" "}
                                    {formatDate(localResume.uploadedAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {uploadPhase === "extracting" ? (
                                <>
                                    <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                                    <span className="text-xs text-indigo-600 font-medium">
                                        Extracting data…
                                    </span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-green-600 font-medium">
                                        Stored on ImageKit
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div
                        className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]"
                        style={{ height: 480 }}
                    >
                        <iframe
                            src={localResume.driveViewLink!}
                            className="w-full h-full"
                            title="Resume Preview"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <a
                            href={localResume.driveViewLink!}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                            >
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
                !isUploading &&
                !isComparing && (
                    <div className="bg-[var(--surface-2)] rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                        <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-3)]">
                            No resume uploaded yet.
                        </p>
                        <p className="text-xs text-[var(--text-3)] mt-1">
                            Upload your resume to improve your profile score and
                            enable skill extraction.
                        </p>
                    </div>
                )
            )}

            {/* Extracted Data View */}
            {!isComparing && localResume?.parsedData ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-[var(--primary-dk)]" />
                            <h3 className="font-semibold text-[var(--text)]">
                                Extracted Resume Data
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                                AI
                            </Badge>
                        </div>
                    </div>
                    <ResumeParsedViewer data={localResume.parsedData} />
                </div>
            ) : (
                !isComparing &&
                hasResume &&
                uploadPhase === "idle" && (
                    <div className="bg-[var(--surface-2)] rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                        <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-3)]">
                            No data extracted yet.
                        </p>
                        <p className="text-xs text-[var(--text-3)] mt-1 mb-3">
                            Click &quot;Re-extract Data&quot; to extract information from
                            your resume.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReextract}
                            loading={reextracting}
                        >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Extract Data
                        </Button>
                    </div>
                )
            )}

            {/* Resume Analysis Section */}
            {!isComparing && localResume?.parsedData && (
                <AnalysisSection
                    analysis={analysis}
                    extractedSkills={extractedSkills}
                    loadingAnalysis={loadingAnalysis}
                    analyzing={analyzing}
                    isUploading={isUploading}
                    activeAnalysisTab={activeAnalysisTab}
                    onTabChange={setActiveAnalysisTab}
                    onAnalyze={handleAnalyze}
                />
            )}

            {/* Internship Match CTA Card */}
            {hasResume && localResume?.parsedData && (
                <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl border border-purple-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <Target className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[var(--text)] text-base mb-1.5">
                                Find Your Perfect Internship Match
                            </h3>
                            <p className="text-sm text-[var(--text-2)] mb-4">
                                Use AI-powered matching to compare your resume against internship descriptions and get detailed compatibility scores with personalized recommendations.
                            </p>
                            <Link href={`/user/${username}/internship-match`}>
                                <Button
                                    size="sm"
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 shadow-md"
                                >
                                    <Target className="h-3.5 w-3.5 mr-1.5" />
                                    Go to Internship Match
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
