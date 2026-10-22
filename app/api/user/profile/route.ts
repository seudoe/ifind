import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { str, strList } from "@/lib/validate";

export const runtime = "nodejs";

/** Only these resume sections may be edited from the profile page (mirrors ParsedResumeData). */
const EDITABLE_RESUME_SECTIONS = new Set([
  "summary", "workHistory", "education", "skills", "projects", "certifications", "languages",
  "publications", "affiliations", "awards", "interests", "metaDetails",
]);
const MAX_SECTION_BYTES = 200_000;

const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || !mongoose.Types.ObjectId.isValid(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const rl = await hit("profile-write", session.userId, RULES.profileWrite);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Invalid request body");
    const { userUpdate, resumeUpdate } = body;
    if (userUpdate !== undefined && (typeof userUpdate !== "object" || userUpdate === null || Array.isArray(userUpdate))) return bad("Invalid userUpdate");
    if (resumeUpdate !== undefined && (typeof resumeUpdate !== "object" || resumeUpdate === null || Array.isArray(resumeUpdate))) return bad("Invalid resumeUpdate");

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB not connected");

    // Fetch existing user to compile checklist
    const existingUser = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(session.userId) });
    if (!existingUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (resumeUpdate && !existingUser.resume?.parsedData) {
      // $set on resume.parsedData.* fails (500) when parsedData is null, i.e. before a resume has been extracted.
      return bad("Upload and extract your resume before editing its sections");
    }

    const setFields: Record<string, any> = {};

    // 1. Process top-level user updates
    if (userUpdate) {
      // Every field is type- and length-checked: a non-string here used to throw (500) or reach the query.
      const text = (key: string, max: number): string | null | undefined => {
        const v = userUpdate[key];
        if (v === undefined) return undefined;
        if (v === null || v === "") return null;
        return str(v, max) ?? undefined;
      };
      for (const key of ["name", "username", "email", "phone", "dateOfBirth", "gender", "city", "state", "country", "profilePicture"]) {
        const v = userUpdate[key];
        if (v !== undefined && v !== null && typeof v !== "string") return bad(`Invalid ${key}`);
      }

      if (userUpdate.name !== undefined) {
        const name = str(userUpdate.name, 100);
        if (!name) return bad("Name is required");
        setFields["name"] = name;
      }
      if (userUpdate.username !== undefined) {
        const cleanUsername = str(userUpdate.username, 20)?.toLowerCase();
        if (!cleanUsername) return bad("Username is required");
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) return bad("Username must be 3-20 letters, numbers or underscores");
        const dup = await db.collection("users").findOne({
          username: cleanUsername,
          _id: { $ne: new mongoose.Types.ObjectId(session.userId) }
        });
        if (dup) return bad("Username is already taken");
        setFields["username"] = cleanUsername;
      }
      if (userUpdate.email !== undefined) {
        const cleanEmail = str(userUpdate.email, 254)?.toLowerCase();
        if (!cleanEmail) return bad("Email is required");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return bad("Enter a valid email address");
        const dup = await db.collection("users").findOne({
          email: cleanEmail,
          _id: { $ne: new mongoose.Types.ObjectId(session.userId) }
        });
        if (dup) return bad("Email is already taken");
        setFields["email"] = cleanEmail;
      }
      const optional: Array<[string, number]> = [["phone", 30], ["dateOfBirth", 40], ["gender", 30], ["city", 100], ["state", 100], ["country", 100]];
      for (const [key, max] of optional) {
        const v = text(key, max);
        if (v === undefined && userUpdate[key] !== undefined) return bad(`Invalid ${key}`);
        if (v !== undefined) setFields[key] = v;
      }
      if (userUpdate.profilePicture !== undefined) {
        const pic = text("profilePicture", 2000);
        // Stored URLs end up in <img src>; only allow web URLs so nothing like javascript: is ever persisted.
        if (pic && !/^https?:\/\//i.test(pic)) return bad("Profile picture must be an http(s) URL");
        setFields["profilePicture"] = pic ?? null;
      }
      if (userUpdate.skills !== undefined) {
        const skills = strList(userUpdate.skills, 100, 80);
        if (!skills) return bad("Invalid skills");
        setFields["skills"] = skills;
      }
    }

    // 2. Process nested resume updates
    if (resumeUpdate) {
      for (const [key, val] of Object.entries(resumeUpdate)) {
        // Allowlist: arbitrary keys would let a client write any field under resume.parsedData.
        if (!EDITABLE_RESUME_SECTIONS.has(key)) return bad(`Unknown resume section: ${key}`);
        if (JSON.stringify(val).length > MAX_SECTION_BYTES) return bad(`Resume section too large: ${key}`);
        setFields[`resume.parsedData.${key}`] = val;
      }
    }

    // Recalculate profile score
    const mergedUser = { ...existingUser, ...setFields };
    for (const [key, val] of Object.entries(setFields)) {
      if (!key.startsWith("resume.parsedData.")) {
        mergedUser[key] = val;
      } else {
        const subKey = key.replace("resume.parsedData.", "");
        if (!mergedUser.resume) mergedUser.resume = {};
        if (!mergedUser.resume.parsedData) mergedUser.resume.parsedData = {};
        mergedUser.resume.parsedData[subKey] = val;
      }
    }

    // Calculate dynamic completion score
    const checklist = [
      !!mergedUser.profilePicture,
      !!mergedUser.phone,
      !!mergedUser.dateOfBirth,
      !!mergedUser.gender,
      !!mergedUser.city,
      !!mergedUser.state,
      !!mergedUser.country,
      Array.isArray(mergedUser.skills) && mergedUser.skills.length >= 3,
    ];
    const fieldsCount = checklist.length;
    const completedCount = checklist.filter(Boolean).length;
    setFields["profileCompletionScore"] = Math.min(100, 35 + Math.round((completedCount / fieldsCount) * 65));
    setFields["updatedAt"] = new Date().toISOString();

    // Smart change detection: check if updated data differs from existing data
    let hasChanged = false;
    for (const [key, val] of Object.entries(setFields)) {
      if (key === "profileCompletionScore" || key === "updatedAt") continue;
      if (!key.startsWith("resume.parsedData.")) {
        if (JSON.stringify(existingUser[key]) !== JSON.stringify(val)) {
          hasChanged = true;
          break;
        }
      } else {
        const subKey = key.replace("resume.parsedData.", "");
        const currentVal = existingUser.resume?.parsedData?.[subKey];
        if (JSON.stringify(currentVal) !== JSON.stringify(val)) {
          hasChanged = true;
          break;
        }
      }
    }

    if (hasChanged && mergedUser.resume?.parsedData) {
      setFields["vectorizationStatus"] = "processing";
    }

    const result = await db.collection("users").findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(session.userId) },
      { $set: setFields },
      {
        returnDocument: "after",
        // The raw driver ignores the schema's `select: false`, so name what must never leave the server.
        projection: { password: 0, failedLoginAttempts: 0, tokenVersion: 0, "resume.bert_vector": 0, "resume.tfidf_vector": 0 },
      }
    );

    if (!result) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const updatedUser = 'value' in result ? result.value : result;

    // Only re-encode vectors & update recommended internships if section data actually changed
    if (hasChanged && mergedUser.resume?.parsedData) {
      const { vectorizeAndRecommendUser } = await import("@/lib/vectorizer");
      void vectorizeAndRecommendUser(session.userId, mergedUser.resume.parsedData);
    }

    return NextResponse.json({
      success: true,
      data: JSON.parse(JSON.stringify(updatedUser)),
    });
  } catch (error) {
    console.error("[user/profile/update]", error);
    return NextResponse.json({ success: false, error: "Unable to update profile data" }, { status: 500 });
  }
}
