import { NextRequest, NextResponse } from "next/server";
import { authCookie, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    console.error("[auth/linkedin/callback] LinkedIn returned error:", errorParam, errorDescription);
    return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent("Authorization code missing from LinkedIn redirect")}`);
  }

  // Verify state cookie
  const savedState = request.cookies.get("linkedin_oauth_state")?.value;
  if (savedState && state && savedState !== state) {
    console.warn("[auth/linkedin/callback] OAuth state mismatch");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || process.env.LinkedIn_OAUTH_API;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${origin}/api/auth/linkedin/callback`;

  if (!clientId || !clientSecret) {
    console.error("[auth/linkedin/callback] Missing LinkedIn client ID or Secret");
    return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent("LinkedIn authentication is not properly configured on server.")}`);
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[auth/linkedin/callback] Token exchange failed:", tokenData);
      const errMsg = tokenData.error_description || tokenData.error || "Failed to exchange code for token";
      return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent(errMsg)}`);
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch User Profile from LinkedIn OpenID UserInfo endpoint
    const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error("[auth/linkedin/callback] UserInfo fetch failed status:", userInfoResponse.status);
      return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent("Failed to fetch profile from LinkedIn")}`);
    }

    const profile: LinkedInUserInfo = await userInfoResponse.json();

    if (!profile.sub) {
      return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent("Invalid LinkedIn profile response")}`);
    }

    const email = (profile.email || `${profile.sub}@linkedin.user`).toLowerCase();
    const name = profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ") || "Student";
    const profilePicture = profile.picture || null;

    await connectDB();

    // 3. Find existing user by linkedinId OR email
    let user = await User.findOne({
      $or: [{ linkedinId: profile.sub }, { email }],
    });

    if (user) {
      // Update existing user with linkedinId or profile picture if missing
      let modified = false;
      if (!user.linkedinId) {
        user.linkedinId = profile.sub;
        modified = true;
      }
      if (profilePicture && !user.profilePicture) {
        user.profilePicture = profilePicture;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      // Create new student user
      let baseUsername = email.split("@")[0].replace(/[^a-z0-9_]/g, "").toLowerCase();
      if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
      if (baseUsername.length > 15) baseUsername = baseUsername.slice(0, 15);

      let username = baseUsername;
      let counter = 1;
      while (await User.exists({ username })) {
        username = `${baseUsername.slice(0, 12)}_${counter}`;
        counter++;
      }

      user = await User.create({
        name,
        username,
        email,
        linkedinId: profile.sub,
        profilePicture,
        role: "student",
      });
    }

    // 4. Create iFind JWT session & set auth cookie
    const session = {
      userId: user.id || user._id.toString(),
      email: user.email,
      username: user.username,
      role: "student" as const,
    };

    const token = signToken(session);
    const cookie = authCookie(token);

    const redirectUrl = new URL(`/user/${user.username}/overview`, origin);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.cookies.delete("linkedin_oauth_state");

    return response;
  } catch (error) {
    console.error("[auth/linkedin/callback] Exception during LinkedIn login:", error);
    return NextResponse.redirect(`${origin}/user/login?error=${encodeURIComponent("An internal error occurred during LinkedIn sign-in")}`);
  }
}
