import type { CampusReportReason } from "./campus";

/** Student-facing shapes of the /api/user/campus/** responses. */
export interface CampusSummaryView {
    _id: string;
    name: string;
    logo: string | null;
    description: string;
    creatorName: string;
    staffCount: number;
    studentCount: number;
    createdAt: string;
    reportCount: number;
    myReport: CampusReportReason | null;
    joined: boolean;
    uidLabel: string;
    courses: { name: string; departments: string[] }[];
}

export interface EnrollmentView {
    collegeId: string;
    entityId: string | null;
    course: string;
    department: string;
    collegeUid: string;
    batch: number;
    currentYear: number | null;
    cgpa: number | null;
    activeBacklogs: number | null;
    phone: string | null;
    collegeEmail: string | null;
    section: string | null;
    emailUpdates: boolean;
    smsUpdates: boolean;
}

export interface CampusStateView {
    enrollment: EnrollmentView | null;
    college: { _id: string; name: string } | null;
    current: CampusSummaryView | null;
    entitiesExist: boolean;
    banner: "none" | "no_entity" | "not_joined";
}

export interface BlockerView {
    applicationId: string;
    internshipId: string;
    company: string;
    designation: string;
    status: string;
}
