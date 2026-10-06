import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getEmpSession } from "@/lib/employerAuth";
import Company, { type ICompany } from "@/models/Company";
import Employer, { type IEmployer } from "@/models/Employer";
import { ROLE_RANK, type MemberRole } from "@/types/employer";

/** Session -> employer document. Null if no session, missing, banned or deleted. */
export async function getValidEmployer(): Promise<IEmployer | null> {
    const session = await getEmpSession();
    if (!session) return null;
    await connectDB();
    const employer = await Employer.findById(session.employerId);
    if (!employer || employer.isBanned || employer.deleteDetails?.deleted) return null;
    return employer;
}

export interface CompanyAccess {
    employer: IEmployer;
    company: ICompany;
    role: MemberRole;
}

/** Page-side check (no HTTP response): null when the employer can't see this company. */
export async function getCompanyAccess(companyId: string, minRole: MemberRole = "recruiter"): Promise<CompanyAccess | null> {
    const employer = await getValidEmployer();
    if (!employer || !mongoose.isValidObjectId(companyId)) return null;
    const company = await Company.findOne({ _id: companyId, isActive: true, "deleteDetails.deleted": { $ne: true } });
    if (!company) return null;
    const member = company.members.find((m) => m.employerId.equals(employer._id));
    if (!member || ROLE_RANK[member.role] < ROLE_RANK[minRole]) return null;
    return { employer, company, role: member.role };
}

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/**
 * API-side check used by every /api/employer/companies/[companyId]/** route.
 * Returns a ready 401/403/404 response or the access triple. Non-members get 404
 * so company ids can't be probed.
 */
export async function requireCompanyRole(
    companyId: string,
    minRole: MemberRole = "recruiter",
): Promise<CompanyAccess | NextResponse> {
    const employer = await getValidEmployer();
    if (!employer) return fail("Unauthorized", 401);
    if (!mongoose.isValidObjectId(companyId)) return fail("Company not found", 404);
    const company = await Company.findOne({ _id: companyId, isActive: true, "deleteDetails.deleted": { $ne: true } });
    if (!company) return fail("Company not found", 404);
    const member = company.members.find((m) => m.employerId.equals(employer._id));
    if (!member) return fail("Company not found", 404);
    if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) return fail("You don't have permission to do this", 403);
    return { employer, company, role: member.role };
}

/** For routes with no company in the URL. */
export async function requireEmployer(): Promise<IEmployer | NextResponse> {
    return (await getValidEmployer()) ?? fail("Unauthorized", 401);
}

export function isResponse(x: unknown): x is NextResponse {
    return x instanceof NextResponse;
}
