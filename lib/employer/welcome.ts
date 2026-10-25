import type mongoose from "mongoose";
import { notify } from "@/lib/employer/notify";

/** First-run notifications for a brand new account. Never throws (notify swallows its own errors). */
export const welcomeStudent = (id: mongoose.Types.ObjectId | string, username: string) =>
    notify({
        recipientType: "student",
        recipientIds: [id],
        type: "welcome",
        title: "Welcome to iFind",
        body: "Upload your resume so we can match you with internships that fit. You can browse and apply any time.",
        link: `/user/${username}/resume`,
    });

export const welcomeEmployer = (id: mongoose.Types.ObjectId | string) =>
    notify({
        recipientType: "employer",
        recipientIds: [id],
        type: "welcome",
        title: "Welcome to iFind for Employers",
        body: "Create your company profile, then post your first internship. A verified company badge builds trust with students.",
        link: "/employer/companies",
    });
