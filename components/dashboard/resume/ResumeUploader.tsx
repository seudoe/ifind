"use client";

import type { RefObject } from "react";
import { Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type UploadPhase = "idle" | "uploading" | "extracting";

interface ResumeUploaderProps {
    /** Owned by the parent: it also triggers the picker from the "replace" button. */
    inputRef: RefObject<HTMLInputElement | null>;
    phase: UploadPhase;
    dragging: boolean;
    hasResume: boolean;
    /** Which extractor will run, shown while extracting. */
    extractorNote: string;
    onDraggingChange: (dragging: boolean) => void;
    onDrop: (e: React.DragEvent) => void;
    onFile: (file: File) => void;
}

export function ResumeUploader({
    inputRef,
    phase,
    dragging,
    hasResume,
    extractorNote,
    onDraggingChange,
    onDrop,
    onFile,
}: ResumeUploaderProps) {
    const busy = phase !== "idle";

    return (
        <div
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-label={hasResume ? "Replace your resume" : "Upload your resume"}
            aria-busy={busy}
            onDragOver={(e) => {
                e.preventDefault();
                onDraggingChange(true);
            }}
            onDragLeave={() => onDraggingChange(false)}
            onDrop={onDrop}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => {
                if (busy || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                inputRef.current?.click();
            }}
            className={[
                "relative border-2 border-dashed rounded-xl p-10 text-center transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                busy ? "pointer-events-none opacity-70 cursor-default" : "cursor-pointer",
                dragging
                    ? "border-[var(--primary)] bg-[var(--primary-bg)]"
                    : "border-[var(--border-2)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)]",
            ].join(" ")}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                }}
            />

            {phase === "uploading" && (
                <div className="flex flex-col items-center gap-3" role="status">
                    <div className="h-12 w-12 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
                        <Upload className="h-6 w-6 text-[var(--primary-dk)] animate-bounce" />
                    </div>
                    <p className="text-sm font-medium text-[var(--primary-dk)]">Uploading resume to ImageKit…</p>
                    <p className="text-xs text-[var(--text-2)]">Saving your file</p>
                </div>
            )}

            {phase === "extracting" && (
                <div className="flex flex-col items-center gap-3" role="status">
                    <div className="h-12 w-12 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-[var(--primary-dk)] animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-[var(--primary-dk)]">Extracting data from resume with AI…</p>
                    <p className="text-xs text-[var(--text-2)]">{extractorNote}</p>
                </div>
            )}

            {phase === "idle" && (
                <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[var(--surface-3)] flex items-center justify-center">
                        <Upload className="h-6 w-6 text-[var(--text-2)]" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-[var(--text)]">
                            {hasResume ? "Drop a new PDF to replace your resume" : "Drag & drop your resume here"}
                        </p>
                        <p className="text-xs text-[var(--text-2)] mt-1">or click to browse — PDF only, max 5MB</p>
                    </div>
                    <Button variant="outline" size="sm" type="button" tabIndex={-1}>
                        {hasResume ? "Replace Resume" : "Choose File"}
                    </Button>
                </div>
            )}
        </div>
    );
}
