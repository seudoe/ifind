import type { ICampusEntity } from "@/models/CampusEntity";

/** Autocomplete options for the internship form, taken from the campus settings. */
export function suggestionsOf(entity: Pick<ICampusEntity, "courses" | "batches">) {
    return {
        courses: entity.courses.map((c) => c.name),
        departments: [...new Set(entity.courses.flatMap((c) => c.departments))],
        batches: entity.batches.map(String),
    };
}
