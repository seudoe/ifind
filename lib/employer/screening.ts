import type { IScreeningQuestion } from "@/models/PlatformInternship";

type RawAnswer = { questionId?: unknown; answer?: unknown };
type Answer = { questionId: string; answer: string | number | string[] };

/**
 * Checks a student's screening answers against the stored questions. Unknown question ids are dropped;
 * returns the cleaned answers or the first problem as a message.
 */
export function validateAnswers(
    questions: Pick<IScreeningQuestion, "_id" | "question" | "type" | "options" | "required">[],
    raw: unknown,
): { answers: Answer[] } | { error: string } {
    const given = new Map((Array.isArray(raw) ? (raw as RawAnswer[]) : []).map((a) => [String(a?.questionId), a?.answer]));
    const answers: Answer[] = [];
    for (const q of questions) {
        const id = String(q._id);
        const v = given.get(id);
        const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) {
            if (q.required) return { error: `Please answer: ${q.question}` };
            continue;
        }
        if (q.type === "number") {
            const n = Number(v);
            if (!Number.isFinite(n)) return { error: `"${q.question}" needs a number` };
            answers.push({ questionId: id, answer: n });
        } else if (q.type === "multi_choice") {
            const list = (Array.isArray(v) ? v : [v]).map(String);
            if (list.some((x) => !q.options.includes(x))) return { error: `Invalid choice for: ${q.question}` };
            answers.push({ questionId: id, answer: list });
        } else if (q.type === "single_choice" || q.type === "yes_no") {
            const ok = q.type === "yes_no" ? ["Yes", "No"] : q.options;
            if (!ok.includes(String(v))) return { error: `Invalid choice for: ${q.question}` };
            answers.push({ questionId: id, answer: String(v) });
        } else {
            const t = String(v).trim().slice(0, 1000);
            if (!t) {
                if (q.required) return { error: `Please answer: ${q.question}` };
                continue;
            }
            answers.push({ questionId: id, answer: t });
        }
    }
    return { answers };
}
