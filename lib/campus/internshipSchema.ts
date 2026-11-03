import { z } from "zod";
import { screeningQuestionSchema } from "@/lib/employer/validation";
import { CAMPUS_COMPANY_TIERS, CAMPUS_ROUND_TYPES, CAMPUS_WORK_MODES } from "@/types/campus";

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());
const text = (max: number) => z.string().trim().max(max);
const url = opt(z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL"));
const list = (maxItems: number, maxLen = 80) => z.array(text(maxLen).min(1)).max(maxItems);
const date = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable());
const num = (min: number, max: number) => z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const numOrNull = (min: number, max: number) => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(min).max(max).nullable());

/**
 * Draft shape: only the company and the designation are mandatory, because most details of a campus drive arrive later
 * (interview date, number of rounds, extra forms). Publishing adds the deadline (see campusInternshipPublishSchema).
 */
export const campusInternshipDraftSchema = z.object({
    company: z.object({
        name: text(150).min(2, "Company name is required"),
        logo: url,
        website: url,
        industry: opt(text(80)),
        tier: z.preprocess((v) => (v === "" ? null : v), z.enum(CAMPUS_COMPANY_TIERS).nullable().optional()),
    }),
    designation: text(150).min(2, "Designation is required"),
    description: text(10000).default(""),
    sourceText: opt(text(20000)),

    deadlineDate: date.default(null),
    assessmentDate: date.default(null),
    interviewDate: date.default(null),
    resultDate: date.default(null),
    rounds: z.array(z.object({ name: text(80).min(1), type: z.enum(CAMPUS_ROUND_TYPES).default("other"), plannedDate: date.default(null), notes: opt(text(500)) })).max(10).default([]),

    startDate: date.default(null),
    duration: z.object({ value: z.coerce.number().min(1).max(60), unit: z.enum(["weeks", "months"]) }).nullable().optional(),
    stipend: z
        .object({
            type: z.enum(["paid", "unpaid", "performance-based"]),
            amount: num(0, 10_000_000),
            currency: opt(text(8)),
            period: z.enum(["monthly", "weekly", "lump-sum"]).nullable().optional(),
        })
        .nullable()
        .optional(),
    workMode: z.enum(CAMPUS_WORK_MODES).default("onsite"),
    locations: list(10, 100).default([]),
    openings: numOrNull(1, 100000).default(null),
    ppoAvailable: z.boolean().default(false),
    skills: list(30, 50).default([]),
    responsibilities: list(30, 300).default([]),
    perks: list(30, 100).default([]),

    eligibility: z
        .object({
            batches: z.array(z.coerce.number().int().min(2000).max(2100)).max(10).default([]),
            courses: list(20, 80).default([]),
            departments: list(40, 80).default([]),
            minCgpa: numOrNull(0, 100).default(null),
            maxBacklogs: numOrNull(0, 100).default(null),
            other: opt(text(1000)),
        })
        .default({ batches: [], courses: [], departments: [], minCgpa: null, maxBacklogs: null }),

    requireResume: z.boolean().default(true),
    screeningQuestions: z.array(screeningQuestionSchema).max(10).default([]),
    maxApplications: numOrNull(1, 100000).default(null),
    attachments: z.array(z.object({ name: text(120).min(1), url: z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u)) })).max(10).default([]),
});
export type CampusInternshipInput = z.infer<typeof campusInternshipDraftSchema>;

/** Rules checked at publish time: students need a deadline to know when to apply by. */
export const campusInternshipPublishSchema = campusInternshipDraftSchema.refine((v) => v.deadlineDate instanceof Date, {
    message: "Set the application deadline to publish",
    path: ["deadlineDate"],
});
