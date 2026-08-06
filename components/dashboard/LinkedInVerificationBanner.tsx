"use client";

import { AlertTriangle, BadgeCheck, Link2Off } from "lucide-react";
import type { User as StudentUser } from "@/types";

interface Props {
  linkedinDetails?: StudentUser["linkedinDetails"];
  className?: string;
}

export function LinkedInVerificationBanner({ linkedinDetails, className = "" }: Props) {
  if (!linkedinDetails) {
    // Yellow for not connected
    return (
      <div className={`p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong className="font-semibold">LinkedIn Status:</strong> User is not connected through LinkedIn
          </span>
        </div>
        <a
          href="/api/auth/linkedin"
          className="px-2.5 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors shrink-0 text-[11px]"
        >
          Connect LinkedIn
        </a>
      </div>
    );
  }

  if (linkedinDetails.email_verified) {
    // Green for verified
    return (
      <div className={`p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 ${className}`}>
        <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          <strong className="font-semibold">LinkedIn Status:</strong> User is LinkedIn verified
        </span>
      </div>
    );
  }

  // Red for not verified on LinkedIn
  return (
    <div className={`p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        <span>
          <strong className="font-semibold">LinkedIn Status:</strong> User is not verified on LinkedIn
        </span>
      </div>
      <a
        href="/api/auth/linkedin"
        className="px-2.5 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shrink-0 text-[11px]"
      >
        Re-verify LinkedIn
      </a>
    </div>
  );
}
