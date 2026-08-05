"use client";

import { useEffect, useState } from "react";
import type { Internship, User } from "@/types";

export interface StudentDashboardData {
  user: User;
  browse: Internship[];
  saved: Internship[];
  recommended: Internship[];
  applied: Internship[];
}

export function useStudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      const response = await fetch("/api/user/dashboard", { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load student data");
      setData(body.data);
    } catch (reason: any) {
      setError(reason instanceof Error ? reason.message : "Unable to load student data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, error, loading, mutate: refetch };
}
