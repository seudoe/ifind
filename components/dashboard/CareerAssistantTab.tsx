"use client";

import { useState } from "react";
import { Sparkles, Edit, Star, MessageCircle, Rocket, BookOpen, TrendingUp, ChevronRight, Copy, Check } from "lucide-react";

type Tool = 'rewriter' | 'star' | 'interview' | 'projects' | 'learning' | 'career';

interface ToolConfig {
  id: Tool;
  name: string;
  icon: any;
  description: string;
  color: string;
}

const TOOLS: ToolConfig[] = [
  {
    id: 'rewriter',
    name: 'Resume Rewriter',
    icon: Edit,
    description: 'Optimize your bullet points for high-impact keywords and professional tone',
    color: 'blue',
  },
  {
    id: 'star',
    name: 'STAR Generator',
    icon: Star,
    description: 'Transform experiences into compelling Situation-Task-Action-Result stories',
    color: 'yellow',
  },
  {
    id: 'interview',
    name: 'Interview Questions',
    icon: MessageCircle,
    description: 'Get personalized practice questions based on your experience',
    color: 'purple',
  },
  {
    id: 'projects',
    name: 'Project Suggestions',
    icon: Rocket,
    description: 'Identify skill gaps and get tailored project ideas',
    color: 'green',
  },
  {
    id: 'learning',
    name: 'Learning Roadmap',
    icon: BookOpen,
    description: 'A curated curriculum to master target technologies',
    color: 'orange',
  },
  {
    id: 'career',
    name: 'Career Roadmap',
    icon: TrendingUp,
    description: 'Visualize your 5-year trajectory to executive roles',
    color: 'pink',
  },
];

export function CareerAssistantTab() {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Rewriter state
  const [rewriteContent, setRewriteContent] = useState('');
  const [rewriteTone, setRewriteTone] = useState('professional');

  // STAR state
  const [starExperience, setStarExperience] = useState('');
  const [starRole, setStarRole] = useState('');
  const [starCompany, setStarCompany] = useState('');

  // Interview state
  const [interviewRole, setInterviewRole] = useState('');
  const [interviewDifficulty, setInterviewDifficulty] = useState('medium');
  const [interviewCount, setInterviewCount] = useState(10);

  // Projects state
  const [projectsTargetRole, setProjectsTargetRole] = useState('');
  const [projectsLevel, setProjectsLevel] = useState('intermediate');
  const [projectsCount, setProjectsCount] = useState(5);

  // Learning state
  const [learningSkills, setLearningSkills] = useState('');
  const [learningTimeframe, setLearningTimeframe] = useState('3-6 months');
  const [learningLevel, setLearningLevel] = useState('beginner');

  // Career state
  const [careerCurrentRole, setCareerCurrentRole] = useState('');
  const [careerTargetRole, setCareerTargetRole] = useState('');
  const [careerIndustry, setCareerIndustry] = useState('Technology');
  const [careerExperience, setCareerExperience] = useState(0);

  const handleToolSelect = (tool: Tool) => {
    setActiveTool(tool);
    setResult(null);
  };

  const handleRewrite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/career-assistant/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: rewriteContent,
          tone: rewriteTone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/career-assistant/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience: starExperience,
          role: starRole,
          company: starCompany,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/career-assistant/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: interviewRole,
          difficulty: interviewDifficulty,
          count: interviewCount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjects = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/career-assistant/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: projectsTargetRole,
          level: projectsLevel,
          count: projectsCount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const skills = learningSkills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/career-assistant/learning-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSkills: skills,
          timeframe: learningTimeframe,
          currentLevel: learningLevel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCareer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/career-assistant/career-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRole: careerCurrentRole,
          targetRole: careerTargetRole,
          industry: careerIndustry,
          yearsOfExperience: careerExperience,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeTool) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Career Assistant</h2>
          <p className="text-gray-600 mt-1">AI-powered tools to advance your career</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className="p-6 bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all text-left group"
              >
                <div className={`w-12 h-12 bg-${tool.color}-100 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-6 w-6 text-${tool.color}-600`} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{tool.name}</h3>
                <p className="text-sm text-gray-600">{tool.description}</p>
                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                  Try it
                  <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentTool = TOOLS.find(t => t.id === activeTool)!;
  const Icon = currentTool.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTool(null);
              setResult(null);
            }}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            ← Back
          </button>
          <div className={`w-10 h-10 bg-${currentTool.color}-100 rounded-lg flex items-center justify-center`}>
            <Icon className={`h-5 w-5 text-${currentTool.color}-600`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{currentTool.name}</h2>
            <p className="text-sm text-gray-600">{currentTool.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold text-gray-900 mb-4">Input</h3>
          
          {activeTool === 'rewriter' && (
            <form onSubmit={handleRewrite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content to Rewrite</label>
                <textarea
                  value={rewriteContent}
                  onChange={(e) => setRewriteContent(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg min-h-[150px]"
                  placeholder="Paste your resume bullet point or description..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <select
                  value={rewriteTone}
                  onChange={(e) => setRewriteTone(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="professional">Professional</option>
                  <option value="creative">Creative</option>
                  <option value="technical">Technical</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Edit className="h-5 w-5" />}
                {loading ? 'Rewriting...' : 'Rewrite'}
              </button>
            </form>
          )}

          {activeTool === 'star' && (
            <form onSubmit={handleStar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience Description</label>
                <textarea
                  value={starExperience}
                  onChange={(e) => setStarExperience(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg min-h-[150px]"
                  placeholder="Describe your experience or achievement..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role (Optional)</label>
                <input
                  type="text"
                  value={starRole}
                  onChange={(e) => setStarRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company (Optional)</label>
                <input
                  type="text"
                  value={starCompany}
                  onChange={(e) => setStarCompany(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Google"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5" />}
                {loading ? 'Generating...' : 'Generate STAR Story'}
              </button>
            </form>
          )}

          {activeTool === 'interview' && (
            <form onSubmit={handleInterview} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Role</label>
                <input
                  type="text"
                  value={interviewRole}
                  onChange={(e) => setInterviewRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Senior Software Engineer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
                <select
                  value={interviewDifficulty}
                  onChange={(e) => setInterviewDifficulty(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
                <input
                  type="number"
                  value={interviewCount}
                  onChange={(e) => setInterviewCount(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="5"
                  max="20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </form>
          )}

          {activeTool === 'projects' && (
            <form onSubmit={handleProjects} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Role</label>
                <input
                  type="text"
                  value={projectsTargetRole}
                  onChange={(e) => setProjectsTargetRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Full Stack Developer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Level</label>
                <select
                  value={projectsLevel}
                  onChange={(e) => setProjectsLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Projects</label>
                <input
                  type="number"
                  value={projectsCount}
                  onChange={(e) => setProjectsCount(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="3"
                  max="10"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                {loading ? 'Generating...' : 'Get Project Ideas'}
              </button>
            </form>
          )}

          {activeTool === 'learning' && (
            <form onSubmit={handleLearning} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Skills (comma-separated)</label>
                <input
                  type="text"
                  value={learningSkills}
                  onChange={(e) => setLearningSkills(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., React, Node.js, MongoDB"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                <select
                  value={learningTimeframe}
                  onChange={(e) => setLearningTimeframe(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="1-3 months">1-3 months</option>
                  <option value="3-6 months">3-6 months</option>
                  <option value="6-12 months">6-12 months</option>
                  <option value="1+ years">1+ years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Level</label>
                <select
                  value={learningLevel}
                  onChange={(e) => setLearningLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
                {loading ? 'Creating...' : 'Create Roadmap'}
              </button>
            </form>
          )}

          {activeTool === 'career' && (
            <form onSubmit={handleCareer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Role</label>
                <input
                  type="text"
                  value={careerCurrentRole}
                  onChange={(e) => setCareerCurrentRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Junior Developer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Role</label>
                <input
                  type="text"
                  value={careerTargetRole}
                  onChange={(e) => setCareerTargetRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Engineering Manager"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <input
                  type="text"
                  value={careerIndustry}
                  onChange={(e) => setCareerIndustry(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                <input
                  type="number"
                  value={careerExperience}
                  onChange={(e) => setCareerExperience(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="0"
                  max="30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                {loading ? 'Creating...' : 'Create Career Roadmap'}
              </button>
            </form>
          )}
        </div>

        {/* Results */}
        <div className="bg-white p-6 rounded-lg border min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Results</h3>
            {result && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>

          {!result ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <div className="text-center">
                <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Fill in the form and click generate to see results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {/* Display results based on tool type */}
              {activeTool === 'rewriter' && result.rewritten && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Original:</p>
                  <div className="p-3 bg-gray-50 rounded text-sm mb-4">{result.original}</div>
                  <p className="text-sm text-gray-600 mb-2">Rewritten ({result.tone}):</p>
                  <div className="p-3 bg-blue-50 rounded text-sm whitespace-pre-wrap">{result.rewritten}</div>
                </div>
              )}

              {activeTool === 'star' && result.star && (
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-sm text-gray-700 mb-1">📍 Situation</p>
                    <p className="text-sm text-gray-900">{result.star.situation}</p>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-700 mb-1">📋 Task</p>
                    <p className="text-sm text-gray-900">{result.star.task}</p>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-700 mb-2">⚡ Action</p>
                    {Array.isArray(result.star.action) ? (
                      <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                        {result.star.action.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-900">{result.star.action}</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-700 mb-2">🎯 Result</p>
                    {Array.isArray(result.star.result) ? (
                      <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                        {result.star.result.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-900">{result.star.result}</p>
                    )}
                  </div>
                  {result.star.bulletPoint && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-medium text-sm text-gray-700 mb-2">📝 Resume Bullet Point</p>
                      <div className="p-3 bg-blue-50 rounded text-sm">{result.star.bulletPoint}</div>
                    </div>
                  )}
                </div>
              )}

              {activeTool === 'interview' && result.questions && (
                <div className="space-y-3">
                  {result.questions.map((q: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{q.category}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{q.difficulty}</span>
                      </div>
                      <p className="font-medium text-gray-900 mb-2">{q.question}</p>
                      {q.hints && q.hints.length > 0 && (
                        <details className="text-sm text-gray-600">
                          <summary className="cursor-pointer hover:text-gray-900">Show hints</summary>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            {q.hints.map((hint: string, hidx: number) => (
                              <li key={hidx}>{hint}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTool === 'projects' && result.projects && (
                <div className="space-y-4">
                  {result.projects.map((project: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{project.title}</h4>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{project.difficulty}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{project.description}</p>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Duration:</span> {project.duration}</p>
                        <div>
                          <span className="font-medium">Skills:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.skills?.map((skill: string, sidx: number) => (
                              <span key={sidx} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Technologies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.technologies?.map((tech: string, tidx: number) => (
                              <span key={tidx} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTool === 'learning' && result.roadmap && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{result.roadmap.title}</h4>
                    <p className="text-sm text-gray-700 mb-2">{result.roadmap.overview}</p>
                    <p className="text-sm text-gray-600">Total Duration: {result.roadmap.totalDuration}</p>
                  </div>
                  {result.roadmap.phases?.map((phase: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900">{phase.phase}</h5>
                        <span className="text-xs text-gray-600">{phase.duration}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{phase.focus}</p>
                      {phase.milestones && (
                        <div className="text-sm">
                          <p className="font-medium mb-1">Milestones:</p>
                          <ul className="list-disc list-inside text-gray-700">
                            {phase.milestones.map((milestone: string, midx: number) => (
                              <li key={midx}>{milestone}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTool === 'career' && result.roadmap && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{result.roadmap.title}</h4>
                    <p className="text-sm text-gray-700">{result.roadmap.overview}</p>
                  </div>
                  {result.roadmap.years?.map((year: any, idx: number) => (
                    <div key={idx} className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900">{year.yearLabel}: {year.targetRole}</h5>
                        {year.salaryRange && (
                          <span className="text-sm text-green-700 font-medium">
                            ${year.salaryRange.min}k - ${year.salaryRange.max}k
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{year.focus}</p>
                      {year.keyMilestones && (
                        <div className="text-sm">
                          <p className="font-medium mb-1">Key Milestones:</p>
                          <ul className="list-disc list-inside text-gray-700">
                            {year.keyMilestones.map((milestone: string, midx: number) => (
                              <li key={midx}>{milestone}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
