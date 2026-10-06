import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { uniqueCompanySlug } from "@/lib/employer/slug";
import { companySchema, zodMessage } from "@/lib/employer/validation";
import { checkImageUrls } from "@/lib/employer/upload";
import Company from "@/models/Company";

export const runtime = "nodejs";

const MAX_COMPANIES_PER_EMPLOYER = 10;

export async function GET() {
    const employer = await requireEmployer();
    if (isResponse(employer)) return employer;
    const companies = await Company.find({
        "members.employerId": employer._id,
        isActive: true,
        "deleteDetails.deleted": { $ne: true },
    })
        .select("name slug logo verification members")
        .sort({ createdAt: -1 })
        .lean();
    const data = companies.map((c) => ({
        _id: String(c._id),
        name: c.name,
        slug: c.slug,
        logo: c.logo ?? null,
        verificationStatus: c.verification?.status ?? "unverified",
        role: c.members.find((m) => String(m.employerId) === String(employer._id))?.role,
    }));
    return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const parsed = companySchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        }
        const input = parsed.data;
        const imgErr = checkImageUrls(input);
        if (imgErr) return NextResponse.json({ success: false, error: imgErr }, { status: 400 });

        const owned = await Company.countDocuments({
            createdBy: employer._id,
            "deleteDetails.deleted": { $ne: true },
        });
        if (owned >= MAX_COMPANIES_PER_EMPLOYER) {
            return NextResponse.json({ success: false, error: `You can register at most ${MAX_COMPANIES_PER_EMPLOYER} companies` }, { status: 400 });
        }

        // Slug uniqueness is checked then enforced by the unique index; retry once on a race
        let company;
        for (let attempt = 0; ; attempt++) {
            try {
                company = await Company.create({
                    ...input,
                    slug: await uniqueCompanySlug(input.name),
                    createdBy: employer._id,
                    members: [{ employerId: employer._id, role: "owner", addedBy: employer._id }],
                    verification: { status: "unverified" },
                });
                break;
            } catch (err) {
                const dup = typeof err === "object" && err && "code" in err && err.code === 11000;
                if (!dup || attempt >= 2) throw err;
            }
        }
        return NextResponse.json({ success: true, data: { _id: company.id, slug: company.slug } }, { status: 201 });
    } catch (error) {
        console.error("[employer/companies POST]", error);
        return NextResponse.json({ success: false, error: "Unable to register company" }, { status: 500 });
    }
}
