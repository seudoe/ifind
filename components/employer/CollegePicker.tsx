"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export interface PickedCollege {
    _id: string;
    name: string;
    state?: string | null;
    city?: string | null;
}

interface Props {
    value: PickedCollege | null;
    onChange: (c: PickedCollege | null) => void;
    /** Search endpoint; employer and student sides differ. */
    endpoint?: string;
    label?: string;
    error?: string;
}

/** Autocomplete over the read-only `colleges` collection (debounced, server-limited to 10 results). */
export function CollegePicker({ value, onChange, endpoint = "/api/employer/colleges/search", label = "College", error }: Props) {
    const [q, setQ] = useState("");
    const [rows, setRows] = useState<PickedCollege[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const seq = useRef(0);

    useEffect(() => {
        if (value || q.trim().length < 2) return;
        const id = ++seq.current;
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`${endpoint}?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
                const j = await res.json();
                if (id === seq.current) setRows(j.success ? j.data : []);
            } catch {
                if (id === seq.current) setRows([]);
            } finally {
                if (id === seq.current) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [q, value, endpoint]);

    const shown = value || q.trim().length < 2 ? [] : rows;

    if (value) {
        return (
            <div className="flex flex-col gap-1.5">
                <span className="label">{label}</span>
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--campus)] bg-[var(--campus-bg)] px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--text)]">
                        <GraduationCap className="h-4 w-4 shrink-0 text-[var(--campus)]" />
                        <span className="truncate">{value.name}</span>
                    </span>
                    <button type="button" onClick={() => { onChange(null); setQ(""); }} className="text-xs text-[var(--text-2)] underline">Change</button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <Input
                label={label}
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Start typing your college name"
                leftIcon={<Search className="h-4 w-4" />}
                error={error}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
            />
            {open && q.trim().length >= 2 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                    {loading && <li className="px-3 py-2 text-xs text-[var(--text-3)]">Searching…</li>}
                    {!loading && shown.length === 0 && <li className="px-3 py-2 text-xs text-[var(--text-3)]">No college found. It may not be listed on iFind yet.</li>}
                    {shown.map((c) => (
                        <li key={c._id}>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">
                                <span className="font-medium text-[var(--text)]">{c.name}</span>
                                {(c.city || c.state) && <span className="block text-xs text-[var(--text-3)]">{[c.city, c.state].filter(Boolean).join(", ")}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
