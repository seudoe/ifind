export interface StudentRow {
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    collegeUid: string;
    course: string;
    department: string;
    batch: number;
    cgpa: number | null;
    activeBacklogs: number | null;
    joinedAt: string | null;
    /** Another student of the same college claims the same college ID. Self-declared data, so staff decide who is real. */
    duplicateUid: boolean;
}
