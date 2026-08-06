"use client";

import React from "react";

export function LinkedInButton({ text = "Continue with LinkedIn" }: { text?: string }) {
  const handleLinkedInAuth = () => {
    window.location.href = "/api/auth/linkedin";
  };

  return (
    <button
      type="button"
      onClick={handleLinkedInAuth}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-[var(--radius-sm)] text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:ring-offset-2"
    >
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
      </svg>
      <span>{text}</span>
    </button>
  );
}
