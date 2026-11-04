import type { ParsedResumeData, ResumeMetaDetails } from "@/types/resume";

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const pick = <T,>(fresh: T | null | undefined, old: T | null | undefined): T | null | undefined => (blank(fresh) ? old : fresh);

/**
 * A new resume replaces everything it describes (skills, projects, education, ...) but must never erase the contact
 * details a previous resume or the student already gave: each meta field and link the new extraction did not find keeps its old value.
 * Links are unioned (new first) so a link the extractor missed survives.
 */
export function keepMeta<T extends Partial<ParsedResumeData> | null | undefined>(old: Partial<ParsedResumeData> | null | undefined, fresh: T): T {
  const o = old?.metaDetails as Partial<ResumeMetaDetails> | undefined;
  if (!fresh || !o) return fresh;
  const f = (fresh.metaDetails ?? {}) as Partial<ResumeMetaDetails>;
  const links = [...(f.extra_links ?? [])];
  for (const l of o.extra_links ?? []) if (l?.link && !links.some((x) => x.link === l.link)) links.push(l);
  const meta = {
    ...f,
    name: pick(f.name, o.name) ?? "",
    phone_no: pick(f.phone_no, o.phone_no) ?? "",
    email: pick(f.email, o.email) ?? "",
    gender: pick(f.gender, o.gender) ?? null,
    github_profile: pick(f.github_profile, o.github_profile) ?? null,
    linkedin: pick(f.linkedin, o.linkedin) ?? null,
    address: {
      ...(f.address ?? {}),
      city: pick(f.address?.city, o.address?.city) ?? "",
      state: pick(f.address?.state, o.address?.state) ?? null,
      country: pick(f.address?.country, o.address?.country) ?? "",
      postal_code: pick(f.address?.postal_code, o.address?.postal_code) ?? "",
    },
    extra_links: links,
  };
  return { ...fresh, metaDetails: meta } as T;
}
