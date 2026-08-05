import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "B.Tech CSE, IIT Delhi",
    placed: "Google SWE Intern",
    text: "iFind matched me with Google based on my actual resume skills — React and TypeScript. The AI recommendations were genuinely accurate, not just keyword stuffing.",
    initials: "PS",
    color: "bg-blue-500",
  },
  {
    name: "Arjun Mehta",
    role: "MBA, IIM Ahmedabad",
    placed: "McKinsey Business Analyst Intern",
    text: "Found a consulting role at McKinsey within a week. The filter system is ridiculously good — I narrowed 10,000 listings to exactly what I needed in 5 minutes.",
    initials: "AM",
    color: "bg-purple-500",
  },
  {
    name: "Sneha Patel",
    role: "B.Des, NID Ahmedabad",
    placed: "Swiggy Product Design Intern",
    text: "As a design student I was worried about finding relevant UI/UX roles. iFind had a dedicated category and the profile completion score kept nudging me to improve.",
    initials: "SP",
    color: "bg-[var(--primary)]",
  },
];

export function Testimonials() {
  return (
    <section className="py-14 bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-bold text-[var(--text)]">Students Love iFind</h2>
          <p className="text-sm text-[var(--text-2)] mt-1">Join 2M+ students who found their internship here</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map(({ name, role, placed, text, initials, color }) => (
            <div key={name} className="plasma-card p-5 flex flex-col gap-4">
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-[var(--text-2)] leading-relaxed flex-1">
                &ldquo;{text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                <div className={`h-9 w-9 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{name}</p>
                  <p className="text-xs text-[var(--text-3)]">{role}</p>
                  <p className="text-xs text-[var(--primary)] font-medium mt-0.5">{placed}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
