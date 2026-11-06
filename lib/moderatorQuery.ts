import { escapeRegex } from "./validate";

export interface ModerationFilters {
    status?: string;
    source?: "scraped" | "employer";
    search?: string;
    name?: string;
    company?: string;
    scoreOp?: "lt" | "gt" | "eq" | "";
    scoreVal?: number | string | null;
}

export function buildModerationFilterQuery(filters: ModerationFilters): Record<string, any> {
    const status = filters.status || "pending_review";
    const query: Record<string, any> = {
        "moderation.status": status,
    };

    if (filters.name?.trim()) {
        query.name = new RegExp(escapeRegex(filters.name.trim()), "i");
    }

    if (filters.company?.trim()) {
        query.company = new RegExp(escapeRegex(filters.company.trim()), "i");
    }

    if (!filters.name?.trim() && !filters.company?.trim() && filters.search?.trim()) {
        const regex = new RegExp(escapeRegex(filters.search.trim()), "i");
        query.$or = [{ name: regex }, { company: regex }];
    }

    const scoreValRaw = filters.scoreVal;
    const scoreVal =
        scoreValRaw !== undefined && scoreValRaw !== null && scoreValRaw !== ""
            ? Number(scoreValRaw)
            : null;
    const scoreOp = filters.scoreOp?.trim();

    if (scoreOp && scoreVal !== null && !isNaN(scoreVal)) {
        if (scoreOp === "lt") {
            query["moderation.score"] = { $lt: scoreVal };
        } else if (scoreOp === "gt") {
            query["moderation.score"] = { $gt: scoreVal };
        } else if (scoreOp === "eq") {
            query["moderation.score"] = {
                $gte: scoreVal - 0.5,
                $lte: scoreVal + 0.5,
            };
        }
    }

    if (filters.source === "employer") {
        query.status = { $ne: "draft" };
    }

    return query;
}
