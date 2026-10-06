import { z } from "zod";
import {
    COMPANY_SIZES, COMPANY_TYPES, MEMBER_ROLES, QUESTION_TYPES, WORK_MODES,
} from "@/types/employer";

/** Empty string -> undefined so optional form inputs validate. */
const opt = <T extends z.ZodTypeAny>(s: T) =>
    z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());

const text = (max: number) => z.string().trim().max(max);
// http(s) only: blocks javascript:/data: URLs
const url = opt(
    z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL"),
);
const list = (maxItems: number, maxLen = 80) => z.array(text(maxLen).min(1)).max(maxItems);

const upper = (re: RegExp, msg: string) =>
    opt(z.string().trim().toUpperCase().regex(re, msg));

export const companySchema = z.object({
    name: text(120).min(2, "Company name is required"),
    legalName: opt(text(160)),
    tagline: opt(text(120)),
    description: text(5000).min(20, "Describe the company (min 20 characters)"),
    logo: url,
    coverImage: url,
    website: url,
    industry: text(80).min(2, "Industry is required"),
    companyType: z.enum(COMPANY_TYPES),
    size: z.enum(COMPANY_SIZES),
    foundedYear: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
    ),
    headquarters: z.object({
        line1: opt(text(200)),
        line2: opt(text(200)),
        city: text(80).min(1, "City is required"),
        state: opt(text(80)),
        country: text(80).min(1).default("India"),
        pincode: opt(text(12)),
    }),
    officeLocations: list(20, 100).default([]),
    contactEmail: z.string().trim().toLowerCase().email("Valid contact email required"),
    contactPhone: opt(text(20)),
    socials: z
        .object({ linkedin: url, twitter: url, instagram: url, github: url })
        .default({}),
    registration: z
        .object({
            gstin: upper(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "Invalid GSTIN"),
            cin: upper(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, "Invalid CIN"),
            pan: upper(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN"),
        })
        .default({}),
    perks: list(30).default([]),
    techStack: list(40, 40).default([]),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const memberSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(MEMBER_ROLES),
});

const screeningQuestionSchema = z
    .object({
        _id: opt(z.string()),
        question: text(300).min(3),
        type: z.enum(QUESTION_TYPES),
        options: list(10, 100).default([]),
        required: z.boolean().default(false),
    })
    .refine((q) => !["single_choice", "multi_choice"].includes(q.type) || q.options.length >= 2, {
        message: "Choice questions need at least 2 options",
        path: ["options"],
    });

const date = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional());
const num = (min: number, max: number) =>
    z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(min).max(max).optional());

/** Draft shape: only the title is mandatory so autosave works. */
export const internshipDraftSchema = z.object({
    name: text(150).min(3, "Title is required"),
    workMode: z.enum(WORK_MODES).default("onsite"),
    country: opt(text(80)),
    state: opt(text(80)),
    city: opt(text(80)),
    openings: num(1, 10000),
    startDate: date,
    duration: z.object({ value: z.coerce.number().min(1).max(60), unit: z.enum(["weeks", "months"]) }).optional(),
    hoursPerWeek: num(1, 80),
    stipend: z
        .object({
            type: z.enum(["paid", "unpaid", "performance-based"]),
            amount: num(0, 10_000_000),
            currency: opt(text(8)),
            period: z.enum(["monthly", "weekly", "lump-sum"]).nullable().optional(),
        })
        .optional(),
    skills: list(30, 50).default([]),
    degree: list(15, 80).optional(),
    field: list(15, 80).optional(),
    experienceRequired: z
        .object({ min: num(0, 60), max: num(0, 60), unit: z.enum(["months", "years"]) })
        .nullable()
        .optional(),
    summary: opt(text(5000)),
    responsibilities: list(30, 300).optional(),
    perks: list(30, 100).optional(),
    whoCanApply: opt(text(1000)),
    ppoAvailable: z.boolean().default(false),
    certificate: z.boolean().default(false),
    deadlineDate: date,
    requireResume: z.boolean().default(true),
    requireCoverLetter: z.boolean().default(false),
    maxApplications: num(1, 100000),
    screeningQuestions: z.array(screeningQuestionSchema).max(10).default([]),
    applyLink: url,
});
export type InternshipInput = z.infer<typeof internshipDraftSchema>;

/** Extra rules checked at publish time. */
export const internshipPublishSchema = internshipDraftSchema.extend({
    summary: text(5000).min(30, "Description needs at least 30 characters"),
    duration: z.object({ value: z.coerce.number().min(1).max(60), unit: z.enum(["weeks", "months"]) }),
    stipend: z.object({
        type: z.enum(["paid", "unpaid", "performance-based"]),
        amount: num(0, 10_000_000),
        currency: opt(text(8)),
        period: z.enum(["monthly", "weekly", "lump-sum"]).nullable().optional(),
    }),
    skills: list(30, 50).min(1, "Add at least one skill"),
});

export const applicationStatusSchema = z.object({
    status: z.enum(["applied", "under_review", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"]).optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    note: opt(text(500)),
});

export const bulkStatusSchema = z.object({
    ids: z.array(z.string()).min(1).max(200),
    status: z.enum(["under_review", "shortlisted", "interview", "offered", "hired", "rejected"]),
});

export const noteSchema = z.object({ text: text(2000).min(1) });

/** Flatten a zod error into one readable string for `{ success:false, error }`. */
export function zodMessage(e: z.ZodError): string {
    return e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}
