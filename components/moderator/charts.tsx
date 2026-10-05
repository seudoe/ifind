"use client";

// Dependency-free SVG/CSS charts for the scrape dashboards.

export const COLORS = {
    green: "#27ae60",
    amber: "#f39c12",
    red: "#e74c3c",
    blue: "#3daee9",
    gray: "#9aa5b1",
    purple: "#8e6bd8",
    slate: "#34495e",
};

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
            {title && <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] mb-3">{title}</h3>}
            {children}
        </div>
    );
}

export function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="text-xs text-[var(--text-3)]">{label}</div>
            <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
            {sub && <div className="text-xs text-[var(--text-3)] mt-0.5">{sub}</div>}
        </div>
    );
}

export interface Series { name: string; color: string; values: number[] }

/** Vertical grouped bars. `unit` is appended to hover labels (e.g. "%"). */
export function GroupedBars({ labels, series, unit = "", height = 160 }: {
    labels: string[]; series: Series[]; unit?: string; height?: number;
}) {
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const everyN = Math.ceil(labels.length / 12) || 1;
    if (!labels.length) return <p className="text-sm text-[var(--text-3)]">No data</p>;
    return (
        <div>
            <div className="flex items-end gap-1" style={{ height }}>
                {labels.map((l, i) => (
                    <div key={l + i} className="flex-1 min-w-0 h-full flex items-end justify-center gap-px">
                        {series.map((s) => {
                            const v = s.values[i] ?? 0;
                            return (
                                <div
                                    key={s.name}
                                    title={`${l} · ${s.name}: ${v}${unit}`}
                                    className="flex-1 rounded-t-sm min-h-[1px]"
                                    style={{ height: `${(v / max) * 100}%`, background: s.color, opacity: v ? 1 : 0.2 }}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="flex gap-1 mt-1">
                {labels.map((l, i) => (
                    <div key={l + i} className="flex-1 min-w-0 text-[10px] text-center text-[var(--text-3)] truncate">
                        {i % everyN === 0 ? l : ""}
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
                {series.map((s) => (
                    <span key={s.name} className="inline-flex items-center gap-1 text-xs text-[var(--text-2)]">
                        <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Horizontal stacked bar; `thin` hides the legend. */
export function StackBar({ parts, thin = false }: { parts: { label: string; value: number; color: string }[]; thin?: boolean }) {
    const total = parts.reduce((a, p) => a + p.value, 0);
    return (
        <div>
            <div className={`flex w-full overflow-hidden rounded-full bg-[var(--surface-3)] ${thin ? "h-1.5" : "h-3"}`}>
                {total > 0 && parts.map((p) => (
                    <div key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
                ))}
            </div>
            {!thin && (
                <div className="flex flex-wrap gap-3 mt-2">
                    {parts.map((p) => (
                        <span key={p.label} className="inline-flex items-center gap-1 text-xs text-[var(--text-2)]">
                            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                            {p.label} <b>{p.value}</b>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Horizontal bars, one row per label. */
export function HBars({ rows, unit = "", color = COLORS.blue, max }: {
    rows: { label: string; value: number }[]; unit?: string; color?: string; max?: number;
}) {
    const top = max ?? Math.max(1, ...rows.map((r) => r.value));
    if (!rows.length) return <p className="text-sm text-[var(--text-3)]">No data</p>;
    return (
        <div className="space-y-1.5">
            {rows.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                    <div className="w-36 shrink-0 truncate text-[var(--text-2)]" title={r.label}>{r.label}</div>
                    <div className="flex-1 h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.value / top) * 100)}%`, background: color }} />
                    </div>
                    <div className="w-14 text-right tabular-nums text-[var(--text)]">{r.value}{unit}</div>
                </div>
            ))}
        </div>
    );
}
