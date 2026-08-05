"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

const POPULAR = ["React Developer", "Data Science", "UI/UX Design", "Marketing", "Finance", "Machine Learning"];

const CATEGORY_PILLS = [
  { label: "Technology",  emoji: "💻" },
  { label: "Design",      emoji: "🎨" },
  { label: "Marketing",   emoji: "📣" },
  { label: "Finance",     emoji: "📊" },
  { label: "Operations",  emoji: "⚙️" },
  { label: "Content",     emoji: "✍️" },
];

export function HeroSection() {
  const router = useRouter();
  const [role, setRole]         = useState("");
  const [location, setLocation] = useState("");

  const handleSearch = () => {
    const p = new URLSearchParams();
    if (role) p.set("q", role);
    if (location) p.set("location", location);
    router.push(`/dashboard?tab=internships&${p.toString()}`);
  };

  return (
    <section className="relative overflow-hidden bg-[var(--surface)] border-b border-[var(--border)]">
      {/* Subtle background texture */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[var(--primary-bg)] opacity-60 translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[var(--primary-bg)] opacity-40 -translate-x-1/4 translate-y-1/4" />
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="var(--text)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="max-w-3xl mx-auto text-center">

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--primary-bg)] border border-[var(--primary)]/20 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            50,000+ active internships right now
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-[var(--text)] leading-tight tracking-tight mb-4">
            Find Internships That{" "}
            <span className="text-[var(--primary)]">Match Your Skills</span>
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-2)] leading-relaxed mb-8 max-w-2xl mx-auto">
            India&apos;s smartest internship platform. Upload your resume once —
            our AI matches you with roles at top companies tailored to your actual profile.
          </p>

          {/* Search card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] p-2 flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 flex-1 px-3">
              <Search className="h-4 w-4 text-[var(--text-3)] shrink-0" />
              <input
                type="text"
                placeholder="Role, skill, or company..."
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none bg-transparent py-2"
              />
            </div>
            <div className="hidden sm:block w-px bg-[var(--border)] self-stretch" />
            <div className="flex items-center gap-2 flex-1 px-3">
              <MapPin className="h-4 w-4 text-[var(--text-3)] shrink-0" />
              <input
                type="text"
                placeholder="City or Work from Home"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none bg-transparent py-2"
              />
            </div>
            <Button onClick={handleSearch} size="md" className="shrink-0 gap-2 px-5">
              Search <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Popular searches */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="text-xs text-[var(--text-3)]">Popular:</span>
            {POPULAR.map((term) => (
              <button
                key={term}
                onClick={() => { setRole(term); handleSearch(); }}
                className="text-xs bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] rounded-[var(--radius-sm)] px-2.5 py-1 transition-all duration-[var(--transition)] text-[var(--text-2)]"
              >
                {term}
              </button>
            ))}
          </div>

          {/* Category quick-links */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {CATEGORY_PILLS.map(({ label, emoji }) => (
              <a
                key={label}
                href={`/dashboard?tab=internships&category=${encodeURIComponent(label)}`}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] transition-all duration-[var(--transition)]"
              >
                <span>{emoji}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
