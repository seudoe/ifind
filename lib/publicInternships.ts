import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import { toStudentInternship, visibleToStudentsFilter } from "@/lib/employer/visibility";
import { escapeRegex } from "@/lib/validate";
import type { Internship } from "@/types";

/**
 * Read-only internship data for pages anyone can open (landing, /internships). Same visibility rules as the
 * student feed: scraped listings must be active, iFind posts must pass `visibleToStudentsFilter`.
 */

const PROJECTION = { bert_vector: 0, tfidf_vector: 0 };
const PLATFORM_PROJECTION = { ...PROJECTION, moderation: 0 };
const serialize = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function collections() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  return { scraped: db.collection("internships"), platform: db.collection("internships.this-platform"), db };
}

/** Category label -> words matched against the internship title (landing chips and /internships?category=). */
export const CATEGORIES: { label: string; code: string; pattern: string }[] = [
  { label: "Technology", code: "TC", pattern: "software|developer|engineer|web|frontend|backend|full ?stack|data|machine learning|\\bai\\b|devops|android|ios|python|java|react|cyber|cloud" },
  { label: "Design", code: "DS", pattern: "design|\\bui\\b|\\bux\\b|figma|graphic|animation|video|creative" },
  { label: "Marketing", code: "MK", pattern: "marketing|seo|social media|growth|brand|sales|business development|campaign" },
  { label: "Finance", code: "FN", pattern: "finance|account|audit|banking|investment|equity|tax|financial" },
  { label: "Operations", code: "OP", pattern: "operations|supply|logistics|\\bhr\\b|human resources|recruit|admin|customer" },
  { label: "Content", code: "CN", pattern: "content|writ|editor|journalis|blog|copy|research|translation" },
];

export interface PublicQuery { q?: string; location?: string; category?: string }

function toFilter(base: Record<string, unknown>, { q, location, category }: PublicQuery): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const words = q?.trim().slice(0, 80);
  if (words) {
    const rx = { $regex: escapeRegex(words), $options: "i" };
    and.push({ $or: [{ name: rx }, { company: rx }, { skills: rx }] });
  }
  const loc = location?.trim().slice(0, 60);
  if (loc) {
    if (/^(wfh|work from home|remote)$/i.test(loc)) and.push({ isRemote: true });
    else {
      const rx = { $regex: escapeRegex(loc), $options: "i" };
      and.push({ $or: [{ "address.city": rx }, { "address.state": rx }, { "address.country": rx }] });
    }
  }
  const cat = CATEGORIES.find((c) => c.label.toLowerCase() === category?.trim().toLowerCase());
  if (cat) and.push({ name: { $regex: cat.pattern, $options: "i" } });
  return and.length ? { ...base, $and: and } : base;
}

const time = (i: Record<string, unknown>) => new Date(String(i.datePublished ?? 0)).getTime() || 0;

async function withLogos(db: mongoose.mongo.Db, platform: Record<string, unknown>[]) {
  const ids = [...new Set(platform.map((i) => String(i.companyId)))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const logos = new Map(
    (ids.length ? await db.collection("companies").find({ _id: { $in: ids } }, { projection: { logo: 1 } }).toArray() : [])
      .map((c) => [String(c._id), c.logo as string | null]),
  );
  return platform.map((i) => toStudentInternship(i, logos.get(String(i.companyId))));
}

/** A page of internships, newest first, merged across scraped and iFind-posted listings. */
export async function listPublicInternships(query: PublicQuery & { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(query.pageSize ?? 12, 1), 48);
  const page = Math.max(Math.floor(query.page ?? 1), 1);
  const { scraped, platform, db } = await collections();
  const scrapedFilter = toFilter({ isActive: true }, query);
  const platformFilter = toFilter(visibleToStudentsFilter() as Record<string, unknown>, query);
  const take = page * pageSize;
  const [a, b, totalA, totalB] = await Promise.all([
    scraped.find(scrapedFilter, { projection: PROJECTION }).sort({ datePublished: -1 }).limit(take).toArray(),
    platform.find(platformFilter, { projection: PLATFORM_PROJECTION }).sort({ datePublished: -1 }).limit(take).toArray(),
    scraped.countDocuments(scrapedFilter),
    platform.countDocuments(platformFilter),
  ]);
  const merged = [...(await withLogos(db, b as Record<string, unknown>[])), ...(a as Record<string, unknown>[])].sort((x, y) => time(y) - time(x));
  return {
    items: serialize(merged.slice((page - 1) * pageSize, page * pageSize)) as unknown as Internship[],
    total: totalA + totalB,
    page,
    pageSize,
  };
}

export async function getPublicInternship(id: string): Promise<Internship | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const _id = new mongoose.Types.ObjectId(id);
  const { scraped, platform, db } = await collections();
  const doc = await scraped.findOne({ _id, isActive: true }, { projection: PROJECTION });
  if (doc) return serialize(doc) as unknown as Internship;
  const post = await platform.findOne({ _id, ...(visibleToStudentsFilter() as Record<string, unknown>) }, { projection: PLATFORM_PROJECTION });
  if (!post) return null;
  const [shaped] = await withLogos(db, [post as Record<string, unknown>]);
  return serialize(shaped) as unknown as Internship;
}

async function loadLanding() {
  const { scraped, platform, db } = await collections();
  const visible = visibleToStudentsFilter() as Record<string, unknown>;
  const [scrapedCount, platformCount, students, companyGroups, platformCompanies, applications, topCompanies, categoryCounts, latest] = await Promise.all([
    scraped.countDocuments({ isActive: true }),
    platform.countDocuments(visible),
    db.collection("users").countDocuments({}),
    scraped.aggregate([{ $match: { isActive: true } }, { $group: { _id: { $toLower: "$company" } } }, { $count: "n" }]).toArray(),
    db.collection("companies").countDocuments({ isActive: true }),
    db.collection("applications").countDocuments({}),
    scraped.aggregate([
      { $match: { isActive: true, company: { $type: "string", $regex: "^[A-Za-z0-9]" } } },
      { $group: { _id: "$company", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ]).toArray(),
    Promise.all(CATEGORIES.map(async (c) => {
      const f = { name: { $regex: c.pattern, $options: "i" } };
      const [x, y] = await Promise.all([scraped.countDocuments({ isActive: true, ...f }), platform.countDocuments({ ...visible, ...f })]);
      return { label: c.label, code: c.code, count: x + y };
    })),
    listPublicInternships({ pageSize: 6 }),
  ]);
  return {
    stats: {
      internships: scrapedCount + platformCount,
      students,
      companies: (companyGroups[0]?.n ?? 0) + platformCompanies,
      applications,
    },
    topCompanies: topCompanies.map((c) => String(c._id)),
    categories: categoryCounts,
    featured: latest.items,
  };
}

/** Landing-page numbers and listings, cached for 5 minutes so the public page is not a database hit per visitor. */
export const getLandingData = unstable_cache(loadLanding, ["landing-data"], { revalidate: 300 });
