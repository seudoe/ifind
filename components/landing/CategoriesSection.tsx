import Link from "next/link";

const CATEGORIES = [
  { label: "Software Development", icon: "💻", count: 12400 },
  { label: "Data Science & AI",    icon: "🤖", count: 8200  },
  { label: "Design & UX",          icon: "🎨", count: 4100  },
  { label: "Marketing",            icon: "📣", count: 5600  },
  { label: "Finance",              icon: "📊", count: 3300  },
  { label: "Operations",           icon: "⚙️", count: 2800  },
  { label: "Content Writing",      icon: "✍️", count: 3900  },
  { label: "Business Dev",         icon: "📈", count: 2100  },
];

export function CategoriesSection() {
  return (
    <section className="py-14 bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[var(--text)]">Browse by Category</h2>
          <p className="text-sm text-[var(--text-2)] mt-1">Explore opportunities across popular domains</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(({ label, icon, count }) => (
            <Link
              key={label}
              href={`/dashboard?tab=internships&category=${encodeURIComponent(label)}`}
              className="group plasma-card p-4 flex flex-col items-start gap-2 hover:-translate-y-0.5 transition-transform duration-[var(--transition)]"
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors duration-[var(--transition)] leading-tight">
                  {label}
                </h3>
                <p className="text-xs text-[var(--text-3)] mt-0.5">{count.toLocaleString()} internships</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
