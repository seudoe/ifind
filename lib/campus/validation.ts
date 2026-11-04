import { z } from "zod";
import { CAMPUS_LISTINGS } from "@/types/campus";

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());
const text = (max: number) => z.string().trim().max(max);
const url = opt(z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL"));

const thisYear = new Date().getFullYear();

/** Profile of a campus entity. `collegeId` is only accepted on create (it can never change afterwards). */
export const campusProfileSchema = z.object({
    name: text(120).min(3, "Name is required (e.g. TCET Placement Cell)"),
    description: text(2000).default(""),
    logo: url,
    coverImage: url,
    contactEmail: opt(z.string().trim().toLowerCase().email("Valid contact email required")),
    contactPhone: opt(text(20)),
    listing: z.enum(CAMPUS_LISTINGS).default("listed"),
    courses: z
        .array(z.object({ name: text(80).min(1), departments: z.array(text(80).min(1)).max(40).default([]) }))
        .max(30)
        .default([]),
    batches: z.array(z.coerce.number().int().min(thisYear - 1).max(thisYear + 8)).max(10).default([]),
    uidLabel: text(40).min(1).default("Unique student ID given by college"),
    policy: z
        .object({
            oneStudentOneOffer: z.boolean().default(false),
            acceptWindowHours: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(1).max(720).optional()),
        })
        .default({ oneStudentOneOffer: false }),
});
export type CampusProfileInput = z.infer<typeof campusProfileSchema>;

export const campusCreateSchema = campusProfileSchema.extend({
    collegeId: z.string().regex(/^[a-f\d]{24}$/i, "Pick a college"),
});
export type CampusCreateInput = z.infer<typeof campusCreateSchema>;

/** Escapes a user string for use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
