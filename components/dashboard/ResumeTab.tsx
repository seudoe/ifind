"use client";

import { useState, useRef } from "react";
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
    Loader2,
    DatabaseZap,
    X,
    ArrowLeftRight,
    ShieldAlert,
    BadgeCheck,
    Link2,
    BarChart3,
    TrendingUp,
    Target,
    Zap,
    Brain,
    Star,
    AlertTriangle,
    Lightbulb,
    Tag,
    Search,
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

// Analysis types
interface AnalysisData {
    _id: string;
    user: string;
    analysisStatus: "pending" | "processing" | "completed" | "failed";
    overallScore: number;
    atsScore: number;
    readabilityScore: number;
    formatScore: number;
    contentScore: number;
    strengths: string[];
    weaknesses: string[];
    keywordMatches: Array<{
        keyword: string;
        category: string;
        frequency: number;
    }>;
    missingSkills: Array<{
        skill: string;
        category: string;
        importance: "high" | "medium" | "low";
    }>;
    recommendations: string[];
    summary: string;
    errorMessage?: string; // Added for error handling
    createdAt: string;
    updatedAt: string;
}

interface ExtractedSkill {
    name: string;
    category: "technical" | "soft" | "language" | "tool";
    proficiency: "beginner" | "intermediate" | "advanced" | "expert";
    verified: boolean;
}

export function ResumeTab({ user, onResumeUpdate }: ResumeTabProps) {
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

    const getScoreColor = (score: number) => {
        if (score >= 85) return "text-green-600 bg-green-50 border-green-200";
        if (score >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
        if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 80) return "Very Good";
        if (score >= 70) return "Good";
        if (score >= 60) return "Fair";
        if (score >= 50) return "Needs Work";
        return "Poor";
    };

    const getProficiencyColor = (proficiency: string) => {
        switch (proficiency) {
            case "expert": return "bg-purple-100 text-purple-700 border-purple-200";
            case "advanced": return "bg-blue-100 text-blue-700 border-blue-200";
            case "intermediate": return "bg-green-100 text-green-700 border-green-200";
            case "beginner": return "bg-gray-100 text-gray-700 border-gray-200";
            default: return "bg-gray-100 text-gray-600 border-gray-200";
        }
    };

    const getImportanceColor = (importance: string) => {
        switch (importance) {
            case "high": return "bg-red-100 text-red-700 border-red-200";
            case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "low": return "bg-green-100 text-green-700 border-green-200";
            default: return "bg-gray-100 text-gray-600 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Resume Analyzer</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Upload your resume, extract data with AI, and get comprehensive analysis with ATS scoring.
                </p>
            </div>

            {/* ── Extractor Plan Banner ─────────────────────────────────── */}
            {isLinkedInVerified ? (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <BadgeCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-blue-900">
                            LinkedIn Verified — Best extractor available
                        </p>
                        <p className="text-xs text-blue-700">
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
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    This action is irreversible
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
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
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
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
                                <Upload className="h-6 w-6 text-blue-600 animate-bounce" />
                            </div>
                            <p className="text-sm font-medium text-blue-600">
                                Uploading resume to ImageKit…
                            </p>
                            <p className="text-xs text-gray-400">
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
                            <p className="text-xs text-gray-400">
                                {isLinkedInVerified && aiRemaining > 0
                                    ? "OpenAI → Gemini (High accuracy)"
                                    : "HuggingFace (Low accuracy)"}
                            </p>
                        </div>
                    )}

                    {uploadPhase === "idle" && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                                <Upload className="h-6 w-6 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">
                                    {hasResume
                                        ? "Drop a new PDF to replace your resume"
                                        : "Drag & drop your resume here"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
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
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Current data
                                </span>
                            </div>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
                                <ResumeDataDisplay data={oldData} />
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
                                <p className="font-medium text-gray-900 text-sm">
                                    Resume.pdf
                                </p>
                                <p className="text-xs text-gray-500">
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
                        className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
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
                    <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
                        <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                            No resume uploaded yet.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
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
                            <Sparkles className="h-5 w-5 text-blue-600" />
                            <h3 className="font-semibold text-gray-900">
                                Extracted Resume Data
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                                AI
                            </Badge>
                        </div>
                    </div>
                    <ResumeDataDisplay data={localResume.parsedData} />
                </div>
            ) : (
                !isComparing &&
                hasResume &&
                uploadPhase === "idle" && (
                    <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
                        <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                            No data extracted yet.
                        </p>
                        <p className="text-xs text-gray-400 mt-1 mb-3">
                            Click "Re-extract Data" to extract information from
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
                <div className="space-y-4">
                    {/* Analysis Header & Trigger */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            <h3 className="font-semibold text-gray-900">
                                Resume Analysis
                            </h3>
                            {analysis && (
                                <Badge variant="secondary" className="text-xs">
                                    Last analyzed {new Date(analysis.updatedAt).toLocaleDateString()}
                                </Badge>
                            )}
                        </div>
                        <Button
                            size="sm"
                            onClick={handleAnalyze}
                            loading={analyzing}
                            disabled={analyzing || isUploading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <Brain className="h-3.5 w-3.5 mr-1.5" />
                            {analyzing ? "Analyzing..." : analysis ? "Re-analyze Resume" : "Analyze Resume"}
                        </Button>
                    </div>

                    {/* Analysis Content */}
                    {loadingAnalysis && !analysis && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                            <Loader2 className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading analysis...</p>
                        </div>
                    )}

                    {!loadingAnalysis && !analysis && !analyzing && (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-8 text-center">
                            <Brain className="h-12 w-12 text-indigo-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-900 mb-1">
                                Get AI-Powered Resume Analysis
                            </p>
                            <p className="text-xs text-gray-600 mb-4">
                                Get comprehensive scoring, skill extraction, and actionable recommendations
                            </p>
                            <Button
                                size="sm"
                                onClick={handleAnalyze}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Brain className="h-3.5 w-3.5 mr-1.5" />
                                Analyze Now
                            </Button>
                        </div>
                    )}

                    {analysis && analysis.analysisStatus === "completed" && (
                        <div className="space-y-4">
                            {/* Score Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <ScoreCard
                                    icon={<Star className="h-4 w-4" />}
                                    label="Overall"
                                    score={analysis.overallScore}
                                    getScoreColor={getScoreColor}
                                    getScoreLabel={getScoreLabel}
                                />
                                <ScoreCard
                                    icon={<Target className="h-4 w-4" />}
                                    label="ATS"
                                    score={analysis.atsScore}
                                    getScoreColor={getScoreColor}
                                    getScoreLabel={getScoreLabel}
                                />
                                <ScoreCard
                                    icon={<FileText className="h-4 w-4" />}
                                    label="Readability"
                                    score={analysis.readabilityScore}
                                    getScoreColor={getScoreColor}
                                    getScoreLabel={getScoreLabel}
                                />
                                <ScoreCard
                                    icon={<Zap className="h-4 w-4" />}
                                    label="Format"
                                    score={analysis.formatScore}
                                    getScoreColor={getScoreColor}
                                    getScoreLabel={getScoreLabel}
                                />
                                <ScoreCard
                                    icon={<Briefcase className="h-4 w-4" />}
                                    label="Content"
                                    score={analysis.contentScore}
                                    getScoreColor={getScoreColor}
                                    getScoreLabel={getScoreLabel}
                                />
                            </div>

                            {/* Summary */}
                            {analysis.summary && (
                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 text-sm mb-2">Summary</h4>
                                            <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                                <button
                                    onClick={() => setActiveAnalysisTab("overview")}
                                    className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                        activeAnalysisTab === "overview"
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveAnalysisTab("details")}
                                    className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                        activeAnalysisTab === "details"
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Detailed Analysis
                                </button>
                            </div>

                            {/* Overview Tab */}
                            {activeAnalysisTab === "overview" && (
                                <div className="space-y-6">
                                    {/* Strengths Section */}
                                    {analysis.strengths?.length > 0 && (
                                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
                                            <div className="bg-white/80 backdrop-blur-sm px-6 py-4 border-b border-green-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-100 rounded-lg">
                                                        <TrendingUp className="h-5 w-5 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-green-900 text-base">
                                                            Strengths
                                                        </h3>
                                                        <p className="text-xs text-green-700">
                                                            {analysis.strengths.length} positive {analysis.strengths.length === 1 ? 'highlight' : 'highlights'} identified
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <ul className="space-y-3">
                                                    {analysis.strengths.map((strength, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
                                                            <div className="mt-0.5">
                                                                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                                            </div>
                                                            <span className="text-sm text-gray-800 leading-relaxed flex-1">{strength}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* Areas to Improve Section */}
                                    {analysis.weaknesses?.length > 0 && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
                                            <div className="bg-white/80 backdrop-blur-sm px-6 py-4 border-b border-amber-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-amber-100 rounded-lg">
                                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-amber-900 text-base">
                                                            Areas to Improve
                                                        </h3>
                                                        <p className="text-xs text-amber-700">
                                                            {analysis.weaknesses.length} {analysis.weaknesses.length === 1 ? 'area' : 'areas'} needing attention
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <ul className="space-y-3">
                                                    {analysis.weaknesses.map((weakness, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm border border-amber-100 hover:shadow-md transition-shadow">
                                                            <div className="mt-0.5">
                                                                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                                            </div>
                                                            <span className="text-sm text-gray-800 leading-relaxed flex-1">{weakness}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* Recommendations Section */}
                                    {analysis.recommendations?.length > 0 && (
                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden">
                                            <div className="bg-white/80 backdrop-blur-sm px-6 py-4 border-b border-blue-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 rounded-lg">
                                                        <Lightbulb className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-blue-900 text-base">
                                                            Recommendations
                                                        </h3>
                                                        <p className="text-xs text-blue-700">
                                                            {analysis.recommendations.length} actionable {analysis.recommendations.length === 1 ? 'suggestion' : 'suggestions'} to enhance your resume
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="space-y-3">
                                                    {analysis.recommendations.map((rec, idx) => (
                                                        <div key={idx} className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                                                            <div className="flex-shrink-0 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                                                                <span className="font-bold text-blue-700 text-sm">{idx + 1}</span>
                                                            </div>
                                                            <span className="text-sm text-gray-800 leading-relaxed flex-1">
                                                                {formatRecommendationText(rec)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Details Tab */}
                            {activeAnalysisTab === "details" && (
                                <div className="space-y-6">
                                    {/* Extracted Skills */}
                                    {extractedSkills?.length > 0 && (
                                        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
                                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-purple-100 rounded-lg">
                                                            <Code className="h-5 w-5 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-purple-900 text-base">
                                                                Extracted Skills
                                                            </h3>
                                                            <p className="text-xs text-purple-700">
                                                                {extractedSkills.length} skills identified from your resume
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                                        AI-Powered
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {extractedSkills.map((skill, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 hover:shadow-md transition-all ${getProficiencyColor(skill.proficiency)}`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-sm truncate">{skill.name}</p>
                                                                <p className="text-xs opacity-70 capitalize mt-0.5">{skill.category}</p>
                                                            </div>
                                                            <Badge variant="secondary" className="text-xs capitalize flex-shrink-0 font-medium">
                                                                {skill.proficiency}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Missing Skills */}
                                    {analysis.missingSkills?.length > 0 && (
                                        <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
                                            <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-orange-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-orange-100 rounded-lg">
                                                        <Search className="h-5 w-5 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-orange-900 text-base">
                                                            Skills Gap Analysis
                                                        </h3>
                                                        <p className="text-xs text-orange-700">
                                                            {analysis.missingSkills.length} in-demand skills missing from your profile
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {analysis.missingSkills.map((skill, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 hover:shadow-md transition-all ${getImportanceColor(skill.importance)}`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-sm truncate">{skill.skill}</p>
                                                                <p className="text-xs opacity-70 capitalize mt-0.5">{skill.category}</p>
                                                            </div>
                                                            <Badge variant="secondary" className="text-xs capitalize flex-shrink-0 font-medium">
                                                                {skill.importance}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Keyword Matches */}
                                    {analysis.keywordMatches?.length > 0 && (
                                        <div className="bg-white rounded-2xl border-2 border-cyan-200 shadow-sm overflow-hidden">
                                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 border-b border-cyan-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-cyan-100 rounded-lg">
                                                        <Tag className="h-5 w-5 text-cyan-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-cyan-900 text-base">
                                                            Keyword Matches
                                                        </h3>
                                                        <p className="text-xs text-cyan-700">
                                                            {analysis.keywordMatches.length} industry keywords found in your resume
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.keywordMatches
                                                        .sort((a, b) => b.frequency - a.frequency)
                                                        .slice(0, 30)
                                                        .map((kw, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-center gap-2 bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl px-4 py-2 hover:shadow-md transition-all hover:scale-105"
                                                            >
                                                                <span className="text-sm font-semibold text-cyan-900">{kw.keyword}</span>
                                                                <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700 border-cyan-200 font-bold">
                                                                    ×{kw.frequency}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {analysis && analysis.analysisStatus === "processing" && (
                        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-8 text-center">
                            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-2" />
                            <p className="text-sm font-medium text-indigo-900">Analysis in progress...</p>
                            <p className="text-xs text-indigo-600 mt-1">This may take 20-30 seconds</p>
                        </div>
                    )}

                    {analysis && analysis.analysisStatus === "failed" && (
                        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-900">Analysis Failed</p>
                                    <p className="text-xs text-red-700 mt-1">{analysis.errorMessage || "An error occurred during analysis"}</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleAnalyze}
                                        className="mt-3"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        Retry Analysis
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Helper function to format markdown-style text
function formatRecommendationText(text: string) {
    // Split by ** to find bold sections
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return (
        <>
            {parts.map((part, idx) => {
                // Check if this part should be bold
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Remove ** and make bold
                    const boldText = part.slice(2, -2);
                    return <strong key={idx} className="font-semibold text-gray-900">{boldText}</strong>;
                }
                // Regular text
                return <span key={idx}>{part}</span>;
            })}
        </>
    );
}

function ScoreCard({
    icon,
    label,
    score,
    getScoreColor,
    getScoreLabel,
}: {
    icon: React.ReactNode;
    label: string;
    score: number;
    getScoreColor: (score: number) => string;
    getScoreLabel: (score: number) => string;
}) {
    const baseColor = getScoreColor(score);
    
    return (
        <div className={`relative rounded-xl border-2 p-5 transition-all hover:scale-105 hover:shadow-lg ${baseColor}`}>
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-3">
                    <div className="opacity-70">
                        {icon}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</span>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                    <div className="mb-1">
                        <p className="text-4xl font-bold leading-none">{score}</p>
                    </div>
                    <p className="text-xs font-medium opacity-75">{getScoreLabel(score)}</p>
                </div>
            </div>
        </div>
    );
}

function ResumeDataDisplay({ data }: { data: ParsedResumeData }) {
    return (
        <div className="space-y-4">
            {data.metaDetails && (
                <Section
                    icon={<MapPin className="h-4 w-4 text-blue-600" />}
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
                                <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                                <a
                                    href={data.metaDetails.github_profile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-sm"
                                >
                                    GitHub
                                </a>
                            </div>
                        )}
                        {data.metaDetails.linkedin && (
                            <div className="flex items-center gap-1">
                                <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                                <a
                                    href={data.metaDetails.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-sm"
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
                    <p className="text-sm text-gray-700">{data.summary}</p>
                </Section>
            )}

            {data.workHistory?.length > 0 && (
                <Section
                    icon={<Briefcase className="h-4 w-4 text-blue-600" />}
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
                                        <p className="font-medium text-sm text-gray-900">
                                            {w.title}
                                        </p>
                                        <p className="text-xs text-gray-600">
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
                                <p className="text-xs text-gray-500">
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
                    icon={<GraduationCap className="h-4 w-4 text-blue-600" />}
                    title="Education"
                >
                    <div className="space-y-3">
                        {data.education.map((e, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-green-200 pl-3 space-y-0.5"
                            >
                                <p className="font-medium text-sm text-gray-900">
                                    {e.institution}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {e.field?.type} in {e.field?.course}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {e.period?.start} –{" "}
                                    {e.period?.isCurrent
                                        ? "Present"
                                        : (e.period?.end ?? "N/A")}
                                </p>
                                {e.output && (
                                    <p className="text-xs text-gray-600">
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
                    icon={<Code className="h-4 w-4 text-blue-600" />}
                    title="Skills"
                >
                    <div className="space-y-3">
                        {data.skills.map((s, i) => (
                            <div key={i}>
                                <div className="flex justify-between mb-1">
                                    <p className="text-sm font-medium text-gray-900">
                                        {s.field}
                                    </p>
                                    {s.yearsOfExperience ? (
                                        <span className="text-xs text-gray-500">
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
                    icon={<Code className="h-4 w-4 text-blue-600" />}
                    title="Projects"
                >
                    <div className="space-y-4">
                        {data.projects.map((p, i) => (
                            <div
                                key={i}
                                className="border-l-2 border-purple-200 pl-3 space-y-1.5"
                            >
                                <p className="font-medium text-sm text-gray-900">
                                    {p.title}
                                </p>
                                {p.role && (
                                    <p className="text-xs text-gray-600">
                                        {p.role}
                                    </p>
                                )}
                                {p.problemStatement && (
                                    <p className="text-xs text-gray-600 italic">
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
                                                className="text-blue-600 hover:underline"
                                            >
                                                Repo
                                            </a>
                                        )}
                                        {p.links.live && (
                                            <a
                                                href={p.links.live}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline"
                                            >
                                                Live
                                            </a>
                                        )}
                                        {p.links.demo && (
                                            <a
                                                href={p.links.demo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline"
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
                    icon={<Award className="h-4 w-4 text-blue-600" />}
                    title="Certifications"
                >
                    <div className="space-y-2">
                        {data.certifications.map((c, i) => (
                            <div key={i} className="flex justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {c.name}
                                    </p>
                                    <p className="text-xs text-gray-600">
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
                                <span className="text-xs text-gray-500 shrink-0">
                                    {c.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.languages?.length > 0 && (
                <Section
                    icon={<Globe className="h-4 w-4 text-blue-600" />}
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
                    icon={<BookOpen className="h-4 w-4 text-blue-600" />}
                    title="Publications"
                >
                    <div className="space-y-2">
                        {data.publications.map((p, i) => (
                            <div key={i}>
                                <a
                                    href={p.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:underline"
                                >
                                    {p.title}
                                </a>
                                <p className="text-xs text-gray-600">
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
                    icon={<Trophy className="h-4 w-4 text-blue-600" />}
                    title="Awards"
                >
                    <div className="space-y-2">
                        {data.awards.map((a, i) => (
                            <div key={i}>
                                <p className="text-sm font-medium text-gray-900">
                                    {a.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {a.issuingBody} · {a.date}
                                </p>
                                {a.justification && (
                                    <p className="text-xs text-gray-600 mt-0.5">
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
                    icon={<Users className="h-4 w-4 text-blue-600" />}
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
                                        <p className="text-sm font-medium text-gray-900">
                                            {a.organization}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {a.role} · {a.type}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-500 shrink-0">
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
                    icon={<Heart className="h-4 w-4 text-blue-600" />}
                    title="Interests"
                >
                    <div className="space-y-2">
                        {data.interests.map((it, i) => (
                            <div key={i}>
                                <p className="text-sm font-medium text-gray-900">
                                    {it.activity}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {it.description}
                                </p>
                                {it.commitmentMetric && (
                                    <p className="text-xs text-gray-500">
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
            {label && (
                <p className="text-xs font-medium text-gray-700 mb-0.5">
                    {label}:
                </p>
            )}
            <ul className="list-disc list-inside space-y-0.5">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}
