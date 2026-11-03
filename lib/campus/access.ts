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

/** Pure role comparison, handy for UI gating and tests. */
export const roleAtLeast = (role: CampusRole, min: CampusRole) => CAMPUS_ROLE_RANK[role] >= CAMPUS_ROLE_RANK[min];

/**
 * Membership decision shared by the page and API guards. Non-members and missing/deleted/inactive entities are both
 * "not_found" so entity ids can't be probed; a member below the required role is "forbidden".
 */
export function resolveMembership(
    entity: Pick<ICampusEntity, "members" | "isActive" | "deleteDetails"> | null,
    employerId: unknown,
    minRole: CampusRole,
): { status: "ok"; role: CampusRole } | { status: "not_found" | "forbidden" } {
    if (!entity || !entity.isActive || entity.deleteDetails?.deleted) return { status: "not_found" };
    const member = entity.members.find((m) => String(m.employerId) === String(employerId));
    if (!member) return { status: "not_found" };
    return roleAtLeast(member.role, minRole) ? { status: "ok", role: member.role } : { status: "forbidden" };
}

async function load(entityId: string) {
    if (!mongoose.isValidObjectId(entityId)) return null;
    return CampusEntity.findOne({ _id: entityId, isActive: true, "deleteDetails.deleted": { $ne: true } });
}

/** Page-side check (no HTTP response): null when the employer can't see this campus. */
export async function getCampusAccess(entityId: string, minRole: CampusRole = "viewer"): Promise<CampusAccess | null> {
    const employer = await getValidEmployer();
    if (!employer) return null;
    const entity = await load(entityId);
    const m = resolveMembership(entity, employer._id, minRole);
    return m.status === "ok" && entity ? { employer, entity, role: m.role } : null;
}

/**
 * API-side check used by every /api/employer/campus/[entityId]/** route. Returns a ready 401/403/404 response or the
 * access triple. Non-members get 404 so entity ids can't be probed.
 */
export async function requireCampusRole(entityId: string, minRole: CampusRole = "viewer"): Promise<CampusAccess | NextResponse> {
    const employer = await getValidEmployer();
    if (!employer) return fail("Unauthorized", 401);
    const entity = await load(entityId);
    const m = resolveMembership(entity, employer._id, minRole);
    if (m.status === "ok" && entity) return { employer, entity, role: m.role };
    return m.status === "forbidden" ? fail("You don't have permission to do this", 403) : fail("Campus not found", 404);
}

/** Null when the entity may post, email or accept joins; otherwise the 403 to return. */
export function campusPostingBlocked(entity: Pick<ICampusEntity, "restriction">): NextResponse | null {
    const r = entity.restriction;
    if (!r || r.status === "none") return null;
    return fail(`This campus has been ${r.status === "banned" ? "banned" : "restricted"} by iFind${r.reason ? `: ${r.reason}` : ""}.`, 403);
}
