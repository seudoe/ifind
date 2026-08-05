import { Upload, FileText, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { User } from "@/types";

export function ResumeTab({ user }: { user: User }) {
  const hasResume = Boolean(user.resume?.driveFileId || user.resume?.uploadedAt);
  return (
    <div className="space-y-5 w-full">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)]">Resume</h2>
        <p className="text-xs text-[var(--text-2)] mt-1">Upload your resume in PDF format. AI will extract your skills, experience and education automatically.</p>
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-[var(--border)] rounded-[var(--radius)] p-10 text-center hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] transition-all duration-[var(--transition)] cursor-pointer group">
        <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] group-hover:bg-[var(--primary-bg)] flex items-center justify-center mx-auto mb-3 transition-colors">
          <Upload className="h-5 w-5 text-[var(--text-3)] group-hover:text-[var(--primary)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text)]">Drag & drop your resume here</p>
        <p className="text-xs text-[var(--text-3)] mt-1">or click to browse — PDF only, max 5MB</p>
        <Button variant="outline" size="sm" className="mt-4" type="button">Choose File</Button>
      </div>

      {/* No resume state */}
      <div className="plasma-card p-5 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[var(--text-3)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--text)]">{hasResume ? "Resume uploaded" : "No resume uploaded yet"}</p>
          <p className="text-xs text-[var(--text-2)] mt-0.5">{hasResume && user.resume.uploadedAt ? `Uploaded ${new Date(user.resume.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.` : "Upload your resume to unlock AI-powered internship recommendations and improve your profile score."}</p>
        </div>
      </div>

      {/* What happens after upload */}
      <div className="plasma-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">What happens after upload</h3>
        </div>
        <div className="space-y-2.5">
          {[
            { icon: FileText, text: "Your PDF is stored securely on Google Drive" },
            { icon: Sparkles, text: "AI extracts skills, education, work history, projects" },
            { icon: FileText, text: "Profile score updates based on completeness" },
            { icon: Sparkles, text: "Recommendation engine matches you to relevant internships" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-[var(--text-2)]">
              <Icon className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
