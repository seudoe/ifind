import type { CampusEligibility } from "@/types/campus";

export interface EligibilityStudent {
    batch: number;
    course: string;
    department: string;
    cgpa?: number | null;
    activeBacklogs?: number | null;
}

export interface EligibilityResult {
    ok: boolean;
    reasons: string[];
}

/** "B. Tech", "b.tech" and "BTech" are the same course: compare letters and digits only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const has = (list: string[] | undefined, v: string) => !list?.length || list.some((x) => norm(x) === norm(v));

/**
 * Single source of truth for "may this student apply / should they be emailed". Self-declared data is treated as such.
 * An unset criterion never excludes; a set numeric criterion with an unknown student value does exclude (asked to fill it in).
 */
export function isEligible(student: EligibilityStudent, rules: CampusEligibility | null | undefined): EligibilityResult {
    const reasons: string[] = [];
    const r = rules ?? {};
    if (r.batches?.length && !r.batches.includes(student.batch)) reasons.push(`Open to batch ${r.batches.join(", ")} only (yours: ${student.batch})`);
    if (!has(r.courses, student.course)) reasons.push(`Open to ${r.courses!.join(", ")} only (yours: ${student.course})`);
    if (!has(r.departments, student.department)) reasons.push(`Open to ${r.departments!.join(", ")} departments only (yours: ${student.department})`);
    if (r.minCgpa != null) {
        if (student.cgpa == null) reasons.push(`Minimum CGPA ${r.minCgpa}: add your CGPA in College details`);
        else if (student.cgpa < r.minCgpa) reasons.push(`Minimum CGPA ${r.minCgpa} (yours: ${student.cgpa})`);
    }
    if (r.maxBacklogs != null) {
        if (student.activeBacklogs == null) reasons.push(`At most ${r.maxBacklogs} active backlogs: add yours in College details`);
        else if (student.activeBacklogs > r.maxBacklogs) reasons.push(`At most ${r.maxBacklogs} active backlogs (yours: ${student.activeBacklogs})`);
    }
    return { ok: reasons.length === 0, reasons };
}
