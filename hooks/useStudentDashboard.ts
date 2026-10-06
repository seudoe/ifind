"use client";

import { useStudent } from "@/components/student/StudentProvider";

export type { StudentDashboardData } from "@/components/student/StudentProvider";

/** Student dashboard data, shared by the whole student area (fetched once by its layout). */
export const useStudentDashboard = useStudent;
