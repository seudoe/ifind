import mongoose from "mongoose";
import CampusEntity from "@/models/CampusEntity";
import { CAMPUS_ROLE_RANK, type CampusRole } from "@/types/campus";

/**
 * Permission rules for team changes (3.2). Returns an error message, or null when allowed.
 *   actor   role of the person acting
 *   target  current role of the member being changed (null when adding)
 *   next    role after the change (null when removing)
 *   self    actor is changing themselves
 * Anyone may leave. Otherwise admin+; and anything touching an owner (current or new role) needs an owner.
 */
export function teamChangeError(actor: CampusRole, target: CampusRole | null, next: CampusRole | null, self: boolean): string | null {
    const leaving = self && next === null;
    if (!leaving && CAMPUS_ROLE_RANK[actor] < CAMPUS_ROLE_RANK.admin) return "You don't have permission to do this";
    if ((target === "owner" || next === "owner") && actor !== "owner") return "Only owners can change owners";
    return null;
}

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));

/**
 * Removes a member. Atomic: when the member is an owner, the update only matches if another owner remains, so two owners
 * leaving at the same moment can never leave the campus ownerless. Returns false when blocked or not a member.
 */
export async function removeMember(entityId: unknown, employerId: unknown, targetIsOwner: boolean): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: oid(entityId), "members.employerId": oid(employerId) };
    if (targetIsOwner) filter.members = { $elemMatch: { role: "owner", employerId: { $ne: oid(employerId) } } };
    const res = await CampusEntity.updateOne(filter, { $pull: { members: { employerId: oid(employerId) } } });
    return res.modifiedCount === 1;
}

/** Changes a role; demoting an owner only matches while another owner remains (atomic, like removeMember). */
export async function setMemberRole(entityId: unknown, employerId: unknown, role: CampusRole, targetIsOwner: boolean): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: oid(entityId) };
    if (targetIsOwner && role !== "owner") filter.members = { $elemMatch: { role: "owner", employerId: { $ne: oid(employerId) } } };
    const res = await CampusEntity.updateOne(
        { ...filter, "members.employerId": oid(employerId) },
        { $set: { "members.$[m].role": role } },
        { arrayFilters: [{ "m.employerId": oid(employerId) }] },
    );
    return res.modifiedCount === 1;
}

/** Adds a member unless already present (atomic). */
export async function addMember(entityId: unknown, employerId: unknown, role: CampusRole, addedBy: unknown): Promise<boolean> {
    const res = await CampusEntity.updateOne(
        { _id: oid(entityId), "members.employerId": { $ne: oid(employerId) } },
        { $push: { members: { employerId: oid(employerId), role, addedBy: oid(addedBy), addedAt: new Date() } } },
    );
    return res.modifiedCount === 1;
}

export const MAX_CAMPUS_MEMBERS = 50;
