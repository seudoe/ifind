"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CampusStateView } from "@/types/campusStudent";

interface CampusCtx {
    state: CampusStateView | null;
    error: string | null;
    refresh: () => Promise<void>;
}

const Ctx = createContext<CampusCtx | null>(null);

async function loadState(): Promise<{ data?: CampusStateView; error?: string }> {
    try {
        const res = await fetch("/api/user/campus/state", { credentials: "include" });
        const j = await res.json();
        return j.success ? { data: j.data } : { error: j.error ?? "Unable to load campus data" };
    } catch {
        return { error: "Unable to load campus data" };
    }
}

/** Loads the student's campus state once for every campus sub-tab; actions call refresh() afterwards. */
export function CampusProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<CampusStateView | null>(null);
    const [error, setError] = useState<string | null>(null);

    const apply = useCallback((r: { data?: CampusStateView; error?: string }) => {
        if (r.data) setState(r.data);
        setError(r.error ?? null);
    }, []);
    const refresh = useCallback(async () => apply(await loadState()), [apply]);

    useEffect(() => {
        let live = true;
        loadState().then((r) => live && apply(r));
        return () => { live = false; };
    }, [apply]);

    const value = useMemo(() => ({ state, error, refresh }), [state, error, refresh]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCampus(): CampusCtx {
    const c = useContext(Ctx);
    if (!c) throw new Error("useCampus must be used inside CampusProvider");
    return c;
}
