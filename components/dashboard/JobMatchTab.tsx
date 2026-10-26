"use client";

import { useState, useEffect } from "react";
import { CreditsBadge, refreshCredits } from "./CreditsBadge";
import { Briefcase, Plus, Sparkles, TrendingUp, Target, AlertCircle, Search } from "lucide-react";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { formatAddresses } from "@/lib/address";
import { getInternshipId } from "@/lib/utils";
import type { Internship } from "@/types";

interface JobDescription {
  _id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  employmentType?: string;
  createdAt: string;
}

interface JobMatch {
  _id: string;
  overallScore: number;
  jobDescriptionId: JobDescription;
  matchDetails: {
    skillsMatch: {
      score: number;
      matchingSkills: Array<{ skill: string; resumeLevel?: string }>;
      missingSkills: string[];
      additionalSkills: string[];
    };
    experienceMatch: {
      score: number;
      analysis: string;
    };
    educationMatch: {
      score: number;
      analysis: string;
    };
    keywordsMatch: {
      score: number;
      matchedKeywords: string[];
      missingKeywords: string[];
    };
  };
  recommendations: string[];
  strengthsForRole: string[];
  gapsToAddress: string[];
  aiAnalysis?: string;
  createdAt: string;
}

/** Plain-text posting built from a stored internship, so the same analysis works for listed and pasted internships. */
function internshipToPosting(i: Internship) {
  const lines = [
    i.summary,
    i.responsibilities?.length ? `Responsibilities:\n${i.responsibilities.map((r) => `- ${r}`).join("\n")}` : "",
    i.skills?.length ? `Required skills: ${i.skills.join(", ")}` : "",
    i.degree?.length ? `Degree: ${i.degree.join(", ")}` : "",
    i.field?.length ? `Field: ${i.field.join(", ")}` : "",
    i.perks?.length ? `Perks: ${i.perks.join(", ")}` : "",
  ].filter(Boolean);
  return {
    title: i.name,
    company: i.company,
    description: lines.join("\n\n") || `${i.name} at ${i.company}`,
    location: i.isRemote ? "Remote" : formatAddresses(i.address, ["city", "state"]),
    employmentType: "internship",
    experienceLevel: "entry",
  };
}

export function JobMatchTab() {
  const student = useStudentDashboard();
  const [step, setStep] = useState<'list' | 'create' | 'results'>('list');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [pickQuery, setPickQuery] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating internship description
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    location: '',
    employmentType: 'internship',
  });

  useEffect(() => {
    loadJobMatches();
    loadJobDescriptions();
  }, []);

  const loadJobDescriptions = async () => {
    try {
      const res = await fetch('/api/job-descriptions');
      const data = await res.json();
      if (data.success) {
        setJobDescriptions(data.data);
      }
    } catch (err) {
      console.error('Error loading internship descriptions:', err);
    }
  };

  const loadJobMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/internship-match');
      const data = await res.json();
      if (data.success) {
        setJobMatches(data.data);
      }
    } catch (err) {
      console.error('Error loading internship matches:', err);
    } finally {
      setLoading(false);
    }
  };

  // Internships the student can pick from: saved, recommended, applied, then the rest of the feed (no duplicates)
  const pickable: Internship[] = (() => {
    const d = student.data;
    if (!d) return [];
    const seen = new Set<string>();
    return [...(d.saved ?? []), ...(d.recommended ?? []), ...(d.applied ?? []), ...(d.browse ?? [])].filter((i) => {
      const id = getInternshipId(i);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  })();
  const q = pickQuery.trim().toLowerCase();
  const pickShown = (q ? pickable.filter((i) => `${i.name} ${i.company} ${(i.skills ?? []).join(' ')}`.toLowerCase().includes(q)) : pickable).slice(0, 30);

  const handleCreateJobDescription = async (e: React.FormEvent, posting: Record<string, unknown> = formData) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/job-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceLevel: 'entry', ...posting }),
      });

      const data = await res.json();

      if (data.success) {
        // Now generate match
        await generateMatch(data.data._id);
        setFormData({ title: '', company: '', description: '', location: '', employmentType: 'internship' });
      } else {
        setError(data.error || 'Failed to create internship description');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMatch = async (jobDescriptionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/internship-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: 'current', // Use current user's resume
          jobDescriptionId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSelectedMatch(data.data);
        setStep('results');
        loadJobMatches();
      } else {
        setError(data.error || 'Failed to generate match');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      refreshCredits();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (step === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New Match</h2>
            <p className="text-gray-600 mt-1">See how well your resume fits an internship</p>
          </div>
          <button
            onClick={() => setStep('list')}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
        </div>

        <div className="flex gap-2">
          {([['existing', 'Pick an internship'], ['new', 'Paste a new one']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === id ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'existing' && (
          <div className="space-y-4 bg-[var(--surface)] p-6 rounded-lg border">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Search by title, company or skill"
                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            )}
            {pickShown.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">{student.data ? 'No internships match your search.' : 'Loading internships...'}</p>
            ) : (
              <ul className="divide-y max-h-[420px] overflow-y-auto">
                {pickShown.map((i) => (
                  <li key={getInternshipId(i)} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
                      <p className="text-xs text-gray-500 truncate">{i.company}{i.skills?.length ? ` · ${i.skills.slice(0, 3).join(', ')}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => handleCreateJobDescription(e, internshipToPosting(i))}
                      className="shrink-0 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <TrendingUp className="h-4 w-4" />
                      {loading ? 'Analyzing...' : 'Match'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'new' && (
        <form onSubmit={handleCreateJobDescription} className="space-y-6 bg-[var(--surface)] p-6 rounded-lg border">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internship Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Data Science Intern"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company *
            </label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Razorpay"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Bengaluru or Remote"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employment Type
            </label>
            <select
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="internship">Internship</option>
              <option value="part-time">Part-time</option>
              <option value="full-time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="remote">Remote</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internship Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[300px]"
              placeholder="Paste the full internship description here..."
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Sparkles className="h-5 w-5 animate-spin" />
                Analyzing Match...
              </>
            ) : (
              <>
                <TrendingUp className="h-5 w-5" />
                Analyze Match
              </>
            )}
          </button>
        </form>
        )}
      </div>
    );
  }

  if (step === 'results' && selectedMatch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Match Results</h2>
            <p className="text-gray-600 mt-1">
              {selectedMatch.jobDescriptionId.title} at {selectedMatch.jobDescriptionId.company}
            </p>
          </div>
          <button
            onClick={() => {
              setStep('list');
              setSelectedMatch(null);
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Back to Matches
          </button>
        </div>

        {/* Overall Score */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Overall Match Score</p>
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {selectedMatch.overallScore}
              <span className="text-3xl text-gray-500">/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div
                className={`h-3 rounded-full ${getScoreBgColor(selectedMatch.overallScore)}`}
                style={{ width: `${selectedMatch.overallScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--surface)] p-4 rounded-lg border">
            <p className="text-sm text-gray-600 mb-1">Skills Match</p>
            <p className={`text-2xl font-bold ${getScoreColor(selectedMatch.matchDetails.skillsMatch.score).split(' ')[0]}`}>
              {selectedMatch.matchDetails.skillsMatch.score}%
            </p>
          </div>
          <div className="bg-[var(--surface)] p-4 rounded-lg border">
            <p className="text-sm text-gray-600 mb-1">Experience</p>
            <p className={`text-2xl font-bold ${getScoreColor(selectedMatch.matchDetails.experienceMatch.score).split(' ')[0]}`}>
              {selectedMatch.matchDetails.experienceMatch.score}%
            </p>
          </div>
          <div className="bg-[var(--surface)] p-4 rounded-lg border">
            <p className="text-sm text-gray-600 mb-1">Education</p>
            <p className={`text-2xl font-bold ${getScoreColor(selectedMatch.matchDetails.educationMatch.score).split(' ')[0]}`}>
              {selectedMatch.matchDetails.educationMatch.score}%
            </p>
          </div>
          <div className="bg-[var(--surface)] p-4 rounded-lg border">
            <p className="text-sm text-gray-600 mb-1">Keywords</p>
            <p className={`text-2xl font-bold ${getScoreColor(selectedMatch.matchDetails.keywordsMatch.score).split(' ')[0]}`}>
              {selectedMatch.matchDetails.keywordsMatch.score}%
            </p>
          </div>
        </div>

        {/* AI Analysis */}
        {selectedMatch.aiAnalysis && (
          <div className="bg-[var(--surface)] p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI Analysis
            </h3>
            <p className="text-gray-700 whitespace-pre-line">{selectedMatch.aiAnalysis}</p>
          </div>
        )}

        {/* Skills Analysis */}
        <div className="bg-[var(--surface)] p-6 rounded-lg border space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Skills Analysis</h3>
          
          {selectedMatch.matchDetails.skillsMatch.matchingSkills.length > 0 && (
            <div>
              <p className="text-sm font-medium text-green-700 mb-2">
                ✓ Matching Skills ({selectedMatch.matchDetails.skillsMatch.matchingSkills.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedMatch.matchDetails.skillsMatch.matchingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {skill.skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedMatch.matchDetails.skillsMatch.missingSkills.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-700 mb-2">
                ✗ Missing Skills ({selectedMatch.matchDetails.skillsMatch.missingSkills.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedMatch.matchDetails.skillsMatch.missingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Strengths */}
        {selectedMatch.strengthsForRole.length > 0 && (
          <div className="bg-[var(--surface)] p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Your Strengths for This Role
            </h3>
            <ul className="space-y-2">
              {selectedMatch.strengthsForRole.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps to Address */}
        {selectedMatch.gapsToAddress.length > 0 && (
          <div className="bg-[var(--surface)] p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Areas to Improve
            </h3>
            <ul className="space-y-2">
              {selectedMatch.gapsToAddress.map((gap, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">!</span>
                  <span className="text-gray-700">{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {selectedMatch.recommendations.length > 0 && (
          <div className="bg-[var(--surface)] p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
            <ul className="space-y-3">
              {selectedMatch.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Internship Match</h2>
          <p className="text-gray-600 mt-1">Compare your resume with internship descriptions</p>
          <CreditsBadge className="mt-2" />
        </div>
        <button
          onClick={() => setStep('create')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Match
        </button>
      </div>

      {loading && jobMatches.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading your matches...</p>
        </div>
      ) : jobMatches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matches yet</h3>
          <p className="text-gray-600 mb-4">Start by adding an internship description to analyze</p>
          <button
            onClick={() => setStep('create')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Match
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobMatches.map((match) => (
            <div
              key={match._id}
              onClick={() => {
                setSelectedMatch(match);
                setStep('results');
              }}
              className="bg-[var(--surface)] p-6 rounded-lg border hover:border-blue-300 cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {match.jobDescriptionId.title}
                  </h3>
                  <p className="text-gray-600">{match.jobDescriptionId.company}</p>
                </div>
                <div className={`px-4 py-2 rounded-lg ${getScoreColor(match.overallScore)}`}>
                  <span className="text-2xl font-bold">{match.overallScore}</span>
                  <span className="text-sm">/100</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Skills</p>
                  <p className="font-medium">{match.matchDetails.skillsMatch.score}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Experience</p>
                  <p className="font-medium">{match.matchDetails.experienceMatch.score}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Education</p>
                  <p className="font-medium">{match.matchDetails.educationMatch.score}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Keywords</p>
                  <p className="font-medium">{match.matchDetails.keywordsMatch.score}%</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-4">
                Analyzed {new Date(match.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
