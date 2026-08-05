const STATS = [
  { value: "50,000+", label: "Active Internships",  emoji: "💼" },
  { value: "2M+",     label: "Students Registered", emoji: "🎓" },
  { value: "10,000+", label: "Partner Companies",   emoji: "🏢" },
  { value: "95%",     label: "Placement Rate",      emoji: "🚀" },
];

export function StatsBar() {
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 lg:divide-x lg:divide-[var(--border)]">
          {STATS.map(({ value, label, emoji }) => (
            <div key={label} className="text-center px-6 py-3">
              <p className="text-sm mb-1">{emoji}</p>
              <p className="text-2xl font-bold text-[var(--primary)]">{value}</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
