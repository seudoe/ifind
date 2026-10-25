"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Internship, User } from "@/types";

export interface StudentDashboardData {
  user: User;
  browse: Internship[];
  saved: Internship[];
  recommended: Internship[];
  applied: Internship[];
}

interface StudentState {
  data: StudentDashboardData | null;
  error: string | null;
  loading: boolean;
  mutate: () => Promise<void>;
}

const StudentContext = createContext<StudentState | null>(null);

/** Fetches the dashboard once for the whole student area; tab changes reuse it. */
export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mutate = useCallback(async () => {
    try {
      const response = await fetch("/api/user/dashboard", { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load student data");
      setData(body.data);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load student data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { mutate(); }, [mutate]);

  const value = useMemo(() => ({ data, error, loading, mutate }), [data, error, loading, mutate]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentState {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside StudentProvider");
  return ctx;
}

/** Like useStudent, but null outside the student area (components shared with other layouts). */
export function useOptionalStudent(): StudentState | null {
  return useContext(StudentContext);
}
