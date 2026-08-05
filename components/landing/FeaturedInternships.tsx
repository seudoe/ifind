import Link from "next/link";
import { MapPin, Clock, IndianRupee, Wifi, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// Static featured internships — replace with API data when ready
const FEATURED = [
  {
    id: "1",
    title: "Frontend Developer Intern",
    company: "Razorpay",
    logo: "R",
    location: "Bangalore",
    isRemote: false,
    stipend: "₹30,000/mo",
    duration: "6 months",
    skills: ["React", "TypeScript", "CSS"],
    tag: "Hot 🔥",
    tagVariant: "danger" as const,
  },
  {
    id: "2",
    title: "Data Science Intern",
    company: "Swiggy",
    logo: "S",
    location: "Remote",
    isRemote: true,
    stipend: "₹25,000/mo",
    duration: "3 months",
    skills: ["Python", "SQL", "ML"],
    tag: "AI Pick ✨",
    tagVariant: "default" as const,
  },
  {
    id: "3",
    title: "Product Design Intern",
    company: "Zepto",
    logo: "Z",
    location: "Mumbai",
    isRemote: false,
    stipend: "₹20,000/mo",
    duration: "4 months",
    skills: ["Figma", "UX Research"],
    tag: "New",
    tagVariant: "success" as const,
  },
  {
    id: "4",
    title: "Backend Engineer Intern",
    company: "CRED",
    logo: "C",
    location: "Remote",
    isRemote: true,
    stipend: "₹35,000/mo",
    duration: "6 months",
    skills: ["Go", "PostgreSQL", "Redis"],
    tag: "Hot 🔥",
    tagVariant: "danger" as const,
  },
];

export function FeaturedInternships() {
  return (
    <section className="py-14 bg-[var(--surface)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h2 className="text-xl font-bold text-[var(--text)]">Featured Internships</h2>
            <p className="text-sm text-[var(--text-2)] mt-1">Handpicked opportunities at top startups</p>
          </div>
          <Link
            href="/dashboard?tab=internships"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard?tab=internships`}
              className="plasma-card p-4 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform duration-[var(--transition)]"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-base font-bold text-[var(--text-2)] shrink-0">
                  {item.logo}
                </div>
                <Badge variant={item.tagVariant} className="text-[10px]">{item.tag}</Badge>
              </div>

              {/* Info */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] line-clamp-2 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--text-3)] mt-0.5">{item.company}</p>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-2)]">
                <span className="flex items-center gap-1">
                  {item.isRemote ? <Wifi className="h-3 w-3 text-green-500" /> : <MapPin className="h-3 w-3" />}
                  {item.location}
                </span>
                <span className="flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {item.stipend}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.duration}
                </span>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1">
                {item.skills.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
