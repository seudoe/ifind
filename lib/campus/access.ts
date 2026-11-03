import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getValidEmployer } from "@/lib/employer/access";
import CampusEntity, { type ICampusEntity } from "@/models/CampusEntity";
import type { IEmployer } from "@/models/Employer";
import { CAMPUS_ROLE_RANK, type CampusRole } from "@/types/campus";

export interface CampusAccess {
    employer: IEmployer;
    entity: ICampusEntity;
    role: CampusRole;
}

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Page-side check (no HTTP response): null when the employer can't see this campus. */
export async function getCampusAccess(entityId: string, minRole: CampusRole = "viewer"): Promise<CampusAccess | null> {
    const employer = await getValidEmployer();
    if (!employer || !mongoose.isValidObjectId(entityId)) return null;
    const entity = await CampusEntity.findOne({ _id: entityId, isActive: true, "deleteDetails.deleted": { $ne: true } });
    if (!entity) return null;
    const member = entity.members.find((m) => m.employerId.equals(employer._id));
    if (!member || CAMPUS_ROLE_RANK[member.role] < CAMPUS_ROLE_RANK[minRole]) return null;
    return { employer, entity, role: member.role };
}

/**
 * API-side check used by every /api/employer/campus/[entityId]/** route. Returns a ready 401/403/404 response or the
 * access triple. Non-members get 404 so entity ids can't be probed.
 */
export async function requireCampusRole(entityId: string, minRole: CampusRole = "viewer"): Promise<CampusAccess | NextResponse> {
    const employer = await getValidEmployer();
    if (!employer) return fail("Unauthorized", 401);
    if (!mongoose.isValidObjectId(entityId)) return fail("Campus not found", 404);
    const entity = await CampusEntity.findOne({ _id: entityId, isActive: true, "deleteDetails.deleted": { $ne: true } });
    if (!entity) return fail("Campus not found", 404);
    const member = entity.members.find((m) => m.employerId.equals(employer._id));
    if (!member) return fail("Campus not found", 404);
    if (CAMPUS_ROLE_RANK[member.role] < CAMPUS_ROLE_RANK[minRole]) return fail("You don't have permission to do this", 403);
    return { employer, entity, role: member.role };
}

/** Pure role comparison, handy for UI gating and tests. */
export const roleAtLeast = (role: CampusRole, min: CampusRole) => CAMPUS_ROLE_RANK[role] >= CAMPUS_ROLE_RANK[min];

/** Null when the entity may post, email or accept joins; otherwise the 403 to return. */
export function campusPostingBlocked(entity: Pick<ICampusEntity, "restriction">): NextResponse | null {
    const r = entity.restriction;
    if (!r || r.status === "none") return null;
    return fail(`This campus has been ${r.status === "banned" ? "banned" : "restricted"} by iFind${r.reason ? `: ${r.reason}` : ""}.`, 403);
}
