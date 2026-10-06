import Company from "@/models/Company";

/** "Acme Corp!" -> "acme-corp", with -2, -3… appended on collision. */
export async function uniqueCompanySlug(name: string): Promise<string> {
    const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company";
    let slug = base;
    for (let n = 2; await Company.exists({ slug }); n++) slug = `${base}-${n}`;
    return slug;
}
