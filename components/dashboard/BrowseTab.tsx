import { Search, SlidersHorizontal } from "lucide-react";
import { InternshipCard } from "@/components/internships/InternshipCard";
import type { Internship } from "@/types";

// Static sample data — replace with API fetch
const SAMPLE: Internship[] = [
  {
    _id: "1", name: "Frontend Developer Intern", company: "Razorpay",
    applyLink: "#", datePublished: "2026-07-01", isRemote: false,
    city: "Bangalore", state: "Karnataka", country: "India",
    stipend: { type: "paid", amount: 30000, currency: "INR", period: "monthly" },
    duration: { value: 6, unit: "months" }, skills: ["React", "TypeScript", "CSS"],
    summary: "Work on the payments dashboard.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-01", updatedAt: "2026-07-01",
  },
  {
    _id: "2", name: "Data Science Intern", company: "Swiggy",
    applyLink: "#", datePublished: "2026-07-05", isRemote: true,
    stipend: { type: "paid", amount: 25000, currency: "INR", period: "monthly" },
    duration: { value: 3, unit: "months" }, skills: ["Python", "SQL", "ML"],
    summary: "Analyse delivery patterns.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-05", updatedAt: "2026-07-05",
  },
  {
    _id: "3", name: "Product Design Intern", company: "Zepto",
    applyLink: "#", datePublished: "2026-07-10", isRemote: false,
    city: "Mumbai", state: "Maharashtra", country: "India",
    stipend: { type: "paid", amount: 20000, currency: "INR", period: "monthly" },
    duration: { value: 4, unit: "months" }, skills: ["Figma", "UX Research"],
    summary: "Design consumer app flows.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-10", updatedAt: "2026-07-10",
  },
  {
    _id: "4", name: "Backend Engineer Intern", company: "CRED",
    applyLink: "#", datePublished: "2026-07-12", isRemote: true,
    stipend: { type: "paid", amount: 35000, currency: "INR", period: "monthly" },
    duration: { value: 6, unit: "months" }, skills: ["Go", "PostgreSQL", "Redis"],
    summary: "Build scalable microservices.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-12", updatedAt: "2026-07-12",
  },
  {
    _id: "5", name: "Marketing Intern", company: "Meesho",
    applyLink: "#", datePublished: "2026-07-15", isRemote: false,
    city: "Bangalore", state: "Karnataka", country: "India",
    stipend: { type: "paid", amount: 15000, currency: "INR", period: "monthly" },
    duration: { value: 3, unit: "months" }, skills: ["SEO", "Content", "Analytics"],
    summary: "Drive user acquisition campaigns.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-15", updatedAt: "2026-07-15",
  },
  {
    _id: "6", name: "iOS Developer Intern", company: "PhonePe",
    applyLink: "#", datePublished: "2026-07-18", isRemote: false,
    city: "Bangalore", state: "Karnataka", country: "India",
    stipend: { type: "paid", amount: 28000, currency: "INR", period: "monthly" },
    duration: { value: 6, unit: "months" }, skills: ["Swift", "Xcode", "UIKit"],
    summary: "Build features in the PhonePe iOS app.", isActive: true,
    experienceRequired: null, createdAt: "2026-07-18", updatedAt: "2026-07-18",
  },
];

export function BrowseTab() {
  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 plasma-card px-3 py-2">
          <Search className="h-4 w-4 text-[var(--text-3)] shrink-0" />
          <input
            type="text"
            placeholder="Search by role, company or skill…"
            className="flex-1 text-sm bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
        </div>
        <button className="plasma-card flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Results */}
      <p className="text-xs text-[var(--text-3)]">{SAMPLE.length} internships found</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {SAMPLE.map((i) => (
          <InternshipCard key={i._id} internship={i} />
        ))}
      </div>
    </div>
  );
}
