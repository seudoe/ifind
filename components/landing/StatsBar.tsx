import StatsCounter from "@/components/ui/stats-counter";

const STATS = [
  { value: 50000,   suffix: "+", label: "Active Internships",  emoji: "💼" },
  { value: 2,       suffix: "M+", label: "Students Registered", emoji: "🎓" },
  { value: 10000,   suffix: "+", label: "Partner Companies",   emoji: "🏢" },
  { value: 95,      suffix: "%", label: "Placement Rate",      emoji: "🚀" },
];

export function StatsBar() {
  return (
    <section aria-label="iFind in numbers" className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 lg:divide-x lg:divide-[var(--border)]">
          {STATS.map(({ value, suffix, label, emoji }) => (
            <div key={label} className="text-center px-6 py-3">
              <p className="text-sm mb-1" aria-hidden>{emoji}</p>
              <p className="text-2xl font-bold text-[var(--primary)]">
                <StatsCounter value={value} suffix={suffix} />
              </p>
              <p className="text-xs text-[var(--text-2)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
