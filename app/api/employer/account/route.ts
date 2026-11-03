import { NextResponse } from "next/server";
import { EMP_COOKIE_NAME } from "@/lib/employerAuth";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import CampusEntity from "@/models/CampusEntity";
import Company from "@/models/Company";

export const runtime = "nodejs";

/** Soft-delete the account. Blocked while this employer is the only owner of any company. */
export async function DELETE() {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const owned = await Company.find({
            "deleteDetails.deleted": { $ne: true },
            members: { $elemMatch: { employerId: employer._id, role: "owner" } },
        }).select("name members");
        const sole = owned.filter((c) => c.members.filter((m) => m.role === "owner").length === 1);
        const campuses = await CampusEntity.find({
            "deleteDetails.deleted": { $ne: true },
            members: { $elemMatch: { employerId: employer._id, role: "owner" } },
        }).select("name members");
        const soleCampuses = campuses.filter((c) => c.members.filter((m) => m.role === "owner").length === 1);
        if (sole.length || soleCampuses.length) {
            const names = [...sole, ...soleCampuses].map((c) => c.name).join(", ");
            return NextResponse.json(
                { success: false, error: `Transfer ownership or delete these first: ${names}` },
                { status: 409 },
            );
        }

        // Leave all remaining companies, then mark deleted
        await Company.updateMany({ "members.employerId": employer._id }, { $pull: { members: { employerId: employer._id } } });
        await CampusEntity.updateMany({ "members.employerId": employer._id }, { $pull: { members: { employerId: employer._id } } });
        employer.deleteDetails = { deleted: true, deletedAt: new Date() };
        await employer.save();

        const response = NextResponse.json({ success: true });
        response.cookies.set(EMP_COOKIE_NAME, "", { maxAge: 0, path: "/" });
        return response;
    } catch (error) {
        console.error("[employer/account DELETE]", error);
        return NextResponse.json({ success: false, error: "Unable to delete account" }, { status: 500 });
    }
}
