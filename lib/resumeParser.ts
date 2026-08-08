/**
 * Resume parser — HuggingFace Space → OpenAI → Gemini fallback chain.
 *
 * Flow:
 *  1. Try HuggingFace Space (seudoe/resume-extract) — free, offline ML, no token cost
 *  2. If HF fails or is unavailable → try OpenAI (gpt-4o)
 *  3. If OpenAI fails (quota/error) → try Gemini (gemini-2.5-flash)
 *  4. If all fail → throw user-friendly error
 */

import type { ParsedResumeData } from "@/types/resume";

const HF_SPACE_URL = "https://seudoe-resume-extract.hf.space";

// Time (in ms) to wait for HuggingFace Space before moving to OpenAI fallback
const MAX_WAIT_FOR_HF_MS = process.env.MAX_WAIT_FOR_HF
  ? Number(process.env.MAX_WAIT_FOR_HF) > 1000
    ? Number(process.env.MAX_WAIT_FOR_HF)
    : Number(process.env.MAX_WAIT_FOR_HF) * 1000
  : 60_000;

const SYSTEM_PROMPT = `You are a resume parsing assistant. Extract all information from the resume and return it in the exact JSON format specified. Be thorough and extract all available information. If a field is not present in the resume, use null or empty array as appropriate.`;

const USER_PROMPT = `Parse this resume and extract all information into the following JSON structure:

{
  "summary": "string (overview/about me section)",
  "workHistory": [{
    "title": "string",
    "company": "string",
    "location": "string",
    "type": "job | internship | volunteer | co-op",
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD or null", "isCurrent": boolean },
    "responsibilities": ["string"],
    "achievements": ["string"]
  }],
  "education": [{
    "institution": "string",
    "field": { "type": "string (e.g., B.S., M.S.)", "course": "string (e.g., Computer Science)" },
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD or null", "isCurrent": boolean },
    "output": "string (GPA, honors, thesis)"
  }],
  "skills": [{
    "field": "string (e.g., Backend Development)",
    "yearsOfExperience": number,
    "lastUsed": "YYYY-MM-DD",
    "tools": [{ "name": "string", "score": number or null }]
  }],
  "projects": [{
    "title": "string",
    "role": "string",
    "links": { "repo": "string", "live": "string or undefined", "demo": "string or undefined" },
    "techStack": ["string"],
    "problemStatement": "string or null",
    "metrics": ["string"],
    "technicalChallenges": ["string"],
    "description": ["string"],
    "architecture": "string"
  }],
  "certifications": [{
    "name": "string", "issuer": "string", "skillsEarned": ["string"], "type": "string", "date": "YYYY-MM-DD"
  }],
  "languages": [{ "lang": "string", "proficiency": "string", "score": "string or undefined" }],
  "publications": [{
    "title": "string", "platform": "string", "type": "paper | article | talk",
    "link": "string", "keywords": ["string"], "date": "YYYY-MM-DD"
  }],
  "affiliations": [{
    "organization": "string", "role": "string", "type": "string", "impact": ["string"],
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD or null", "isCurrent": boolean }
  }],
  "awards": [{ "name": "string", "issuingBody": "string", "date": "YYYY-MM-DD", "justification": "string" }],
  "interests": [{ "activity": "string", "description": "string", "commitmentMetric": "string or undefined" }],
  "metaDetails": {
    "name": "string", "phone_no": "string", "email": "string",
    "github_profile": "string or null", "linkedin": "string or null",
    "address": { "city": "string", "state": "string or null", "country": "string", "postal_code": "string" },
    "extra_links": [{ "name": "string", "link": "string" }]
  }
}

Return ONLY the JSON object, no additional text or markdown formatting.`;

function normaliseHFOutput(raw: any): any {
    if (!raw) return raw;
    const meta = raw._meta ?? {};
    const metaDetails = {
        name: meta.name ?? "",
        phone_no: meta.phone ?? "",
        email: meta.email ?? "",
        github_profile: meta.github ?? null,
        linkedin: meta.linkedin ?? null,
        address: {
            city: "",
            state: "",
            country: "",
            postal_code: "",
        },
        extra_links: (meta.otherLinks ?? []).map((l: any) => ({
            name: l.label ?? l.url ?? "",
            link: l.url ?? "",
        })),
    };
    const { _meta, ...rest } = raw;
    return { ...rest, metaDetails };
}

// ─── 1. HuggingFace Space parser ──────────────────────────────────────────────

async function parseWithHuggingFace(
    pdfBuffer: Buffer,
): Promise<ParsedResumeData> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(pdfBuffer)], {
        type: "application/pdf",
    });
    formData.append("file", blob, "resume.pdf");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAX_WAIT_FOR_HF_MS);

    try {
        const res = await fetch(`${HF_SPACE_URL}/extract`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(
                `HF Space responded ${res.status}: ${text.slice(0, 200)}`,
            );
        }

        const json = await res.json();
        return normaliseHFOutput(json);
    } finally {
        clearTimeout(timer);
    }
}

// ─── 2. OpenAI parser (direct REST call) ──────────────────────────────────────

async function parseWithOpenAI(pdfBuffer: Buffer): Promise<ParsedResumeData> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const base64Pdf = pdfBuffer.toString("base64");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        { type: "text", text: USER_PROMPT },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:application/pdf;base64,${base64Pdf}`,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(
            `OpenAI API error ${res.status}: ${text.slice(0, 200)}`,
        );
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content response from OpenAI");

    return JSON.parse(content);
}

// ─── 3. Gemini parser ─────────────────────────────────────────────────────────

async function parseWithGemini(pdfBuffer: Buffer): Promise<ParsedResumeData> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const base64Pdf = pdfBuffer.toString("base64");

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: `${SYSTEM_PROMPT}\n\n${USER_PROMPT}` },
                            {
                                inline_data: {
                                    mime_type: "application/pdf",
                                    data: base64Pdf,
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                },
            }),
        },
    );

    if (!res.ok) {
        const err = await res
            .json()
            .catch(() => ({ error: { message: res.statusText } }));
        const message = err?.error?.message ?? res.statusText;
        throw new Error(`Gemini API error ${res.status}: ${message}`);
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no content");

    const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    return JSON.parse(cleaned);
}

// ─── Public 3-tier Fallback API ─────────────────────────────────────────────

export async function parseResumeWithAI(
    pdfBuffer: Buffer,
): Promise<ParsedResumeData> {
    // 1. HuggingFace Space
    try {
        console.log(
            `[resumeParser] Trying HuggingFace Space (timeout: ${MAX_WAIT_FOR_HF_MS / 1000}s)...`,
        );
        const result = await parseWithHuggingFace(pdfBuffer);
        console.log("[resumeParser] HuggingFace Space succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] HuggingFace Space failed — ${msg}`);
    }

    // 2. OpenAI
    try {
        console.log("[resumeParser] Trying OpenAI...");
        const result = await parseWithOpenAI(pdfBuffer);
        console.log("[resumeParser] OpenAI succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] OpenAI failed — ${msg}`);
    }

    // 3. Gemini
    try {
        console.log("[resumeParser] Trying Gemini...");
        const result = await parseWithGemini(pdfBuffer);
        console.log("[resumeParser] Gemini succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] Gemini failed — ${msg}`);
    }

    // All failed
    console.error(
        "[resumeParser] All 3 resume parser providers (HF -> OpenAI -> Gemini) failed.",
    );
    throw new Error(
        "Unable to extract resume data at this moment. Please try again later.",
    );
}

// ─── Public: HuggingFace-only extractor (low-accuracy, unlimited) ────────────

export async function parseResumeWithHF(
    pdfBuffer: Buffer,
): Promise<ParsedResumeData> {
    try {
        console.log("[resumeParser] HF-only extraction requested...");
        const result = await parseWithHuggingFace(pdfBuffer);
        console.log("[resumeParser] HuggingFace succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] HuggingFace failed — ${msg}`);
        throw new Error(
            "Low-accuracy extractor is currently unavailable. Please try again later.",
        );
    }
}

// ─── Public: Best-AI extractor (OpenAI → Gemini, no HF) ─────────────────────

export async function parseResumeWithBestAI(
    pdfBuffer: Buffer,
): Promise<ParsedResumeData> {
    // 1. OpenAI
    try {
        console.log("[resumeParser] Best-AI: Trying OpenAI...");
        const result = await parseWithOpenAI(pdfBuffer);
        console.log("[resumeParser] OpenAI succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] OpenAI failed — ${msg}`);
    }

    // 2. Gemini
    try {
        console.log("[resumeParser] Best-AI: Trying Gemini...");
        const result = await parseWithGemini(pdfBuffer);
        console.log("[resumeParser] Gemini succeeded.");
        return result;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[resumeParser] Gemini failed — ${msg}`);
    }

    throw new Error(
        "AI extractor is currently unavailable. Please try again later.",
    );
}

// ─── Helper: get current month string "YYYY-MM" ──────────────────────────────

export function getCurrentMonthYear(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const AI_EXTRACTION_MONTHLY_LIMIT = 3;
