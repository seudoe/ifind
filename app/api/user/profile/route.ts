import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || !mongoose.Types.ObjectId.isValid(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { userUpdate, resumeUpdate } = body;

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB not connected");

    // Fetch existing user to compile checklist
    const existingUser = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(session.userId) });
    if (!existingUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const setFields: Record<string, any> = {};

    // 1. Process top-level user updates
    if (userUpdate) {
      const { name, username, email, phone, dateOfBirth, gender, city, state, country, skills, profilePicture } = userUpdate;

      if (name !== undefined) {
        if (!name.trim()) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
        setFields["name"] = name.trim();
      }
      if (username !== undefined) {
        if (!username.trim()) return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 });
        const cleanUsername = username.toLowerCase().trim();
        // Check duplicate
        const dup = await db.collection("users").findOne({
          username: cleanUsername,
          _id: { $ne: new mongoose.Types.ObjectId(session.userId) }
        });
        if (dup) return NextResponse.json({ success: false, error: "Username is already taken" }, { status: 400 });
        setFields["username"] = cleanUsername;
      }
      if (email !== undefined) {
        if (!email.trim()) return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
        const cleanEmail = email.toLowerCase().trim();
        // Check duplicate
        const dup = await db.collection("users").findOne({
          email: cleanEmail,
          _id: { $ne: new mongoose.Types.ObjectId(session.userId) }
        });
        if (dup) return NextResponse.json({ success: false, error: "Email is already taken" }, { status: 400 });
        setFields["email"] = cleanEmail;
      }
      if (phone !== undefined) setFields["phone"] = phone || null;
      if (dateOfBirth !== undefined) setFields["dateOfBirth"] = dateOfBirth || null;
      if (gender !== undefined) setFields["gender"] = gender || null;
      if (city !== undefined) setFields["city"] = city || null;
      if (state !== undefined) setFields["state"] = state || null;
      if (country !== undefined) setFields["country"] = country || null;
      if (profilePicture !== undefined) setFields["profilePicture"] = profilePicture || null;
      if (skills !== undefined) setFields["skills"] = Array.isArray(skills) ? skills.filter(Boolean) : [];
    }

    // 2. Process nested resume updates
    if (resumeUpdate) {
      for (const [key, val] of Object.entries(resumeUpdate)) {
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
      { returnDocument: "after" }
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
