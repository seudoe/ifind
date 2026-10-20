import {
    FileText,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Briefcase,
    Code,
    Loader2,
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
import { ScoreCard } from "./ScoreCard";
import { formatRecommendationText } from "./formatRecommendationText";
import type { AnalysisData, ExtractedSkill } from "./types";

interface AnalysisSectionProps {
    analysis: AnalysisData | null;
    extractedSkills: ExtractedSkill[];
    loadingAnalysis: boolean;
    analyzing: boolean;
    isUploading: boolean;
    activeAnalysisTab: "overview" | "details";
    onTabChange: (tab: "overview" | "details") => void;
    onAnalyze: () => void;
}

export function AnalysisSection({
    analysis,
    extractedSkills,
    loadingAnalysis,
    analyzing,
    isUploading,
    activeAnalysisTab,
    onTabChange,
    onAnalyze,
}: AnalysisSectionProps) {
    const getScoreColor = (score: number) => {
        if (score >= 85) return "text-green-600 bg-green-50 border-green-200";
        if (score >= 70) return "text-[var(--primary-dk)] bg-[var(--primary-bg)] border-blue-200";
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
            case "advanced": return "bg-blue-100 text-[var(--primary-dk)] border-blue-200";
            case "intermediate": return "bg-green-100 text-green-700 border-green-200";
            case "beginner": return "bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border)]";
            default: return "bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border)]";
        }
    };


    const getImportanceColor = (importance: string) => {
        switch (importance) {
            case "high": return "bg-red-100 text-red-700 border-red-200";
            case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "low": return "bg-green-100 text-green-700 border-green-200";
            default: return "bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border)]";
        }
    };

    return (
        <div className="space-y-4">
            {/* Analysis Header & Trigger */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-[var(--text)]">
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
                    onClick={onAnalyze}
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
                <div className="bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-8 text-center">
                    <Loader2 className="h-8 w-8 text-[var(--text-3)] animate-spin mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-3)]">Loading analysis...</p>
                </div>
            )}

            {!loadingAnalysis && !analysis && !analyzing && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-8 text-center">
                    <Brain className="h-12 w-12 text-indigo-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-[var(--text)] mb-1">
                        Get AI-Powered Resume Analysis
                    </p>
                    <p className="text-xs text-[var(--text-2)] mb-4">
                        Get comprehensive scoring, skill extraction, and actionable recommendations
                    </p>
                    <Button
                        size="sm"
                        onClick={onAnalyze}
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
                        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
                            <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <FileText className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-[var(--text)] text-sm mb-2">Summary</h4>
                                    <p className="text-sm text-[var(--text-2)] leading-relaxed">{analysis.summary}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-[var(--surface-3)] rounded-xl">
                        <button
                            onClick={() => onTabChange("overview")}
                            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                activeAnalysisTab === "overview"
                                    ? "bg-[var(--surface)] text-indigo-700 shadow-sm"
                                    : "text-[var(--text-2)] hover:text-[var(--text)]"
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => onTabChange("details")}
                            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                                activeAnalysisTab === "details"
                                    ? "bg-[var(--surface)] text-indigo-700 shadow-sm"
                                    : "text-[var(--text-2)] hover:text-[var(--text)]"
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
                                                <li key={idx} className="flex items-start gap-3 bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
                                                    <div className="mt-0.5">
                                                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                                    </div>
                                                    <span className="text-sm text-[var(--text)] leading-relaxed flex-1">{strength}</span>
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
                                                <li key={idx} className="flex items-start gap-3 bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-amber-100 hover:shadow-md transition-shadow">
                                                    <div className="mt-0.5">
                                                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                                    </div>
                                                    <span className="text-sm text-[var(--text)] leading-relaxed flex-1">{weakness}</span>
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
                                                <Lightbulb className="h-5 w-5 text-[var(--primary-dk)]" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-blue-900 text-base">
                                                    Recommendations
                                                </h3>
                                                <p className="text-xs text-[var(--primary-dk)]">
                                                    {analysis.recommendations.length} actionable {analysis.recommendations.length === 1 ? 'suggestion' : 'suggestions'} to enhance your resume
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="space-y-3">
                                            {analysis.recommendations.map((rec, idx) => (
                                                <div key={idx} className="flex items-start gap-3 bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                                                    <div className="flex-shrink-0 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                                                        <span className="font-bold text-[var(--primary-dk)] text-sm">{idx + 1}</span>
                                                    </div>
                                                    <span className="text-sm text-[var(--text)] leading-relaxed flex-1">
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
                                <div className="bg-[var(--surface)] rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
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
                                <div className="bg-[var(--surface)] rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
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
                                <div className="bg-[var(--surface)] rounded-2xl border-2 border-cyan-200 shadow-sm overflow-hidden">
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
                                onClick={onAnalyze}
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
    );
}
