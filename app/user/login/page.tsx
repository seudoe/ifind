"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { NextLink } from "@/components/auth/NextLink";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthShell } from "@/components/auth/AuthShell";
import { resolveNext } from "@/lib/authRedirect";

const schema = z.object({
    identifier: z.string().min(1, "Email or username is required"),
    password: z.string().min(1, "Password is required"),
});
type Form = z.infer<typeof schema>;

function AuthErrorNotifier() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const error = searchParams.get("error");
    const deleted = searchParams.get("deleted");
    if (error) {
      toast.error(decodeURIComponent(error));
    }
    if (deleted === "true") {
      toast.info("Your account has been scheduled for deletion. You can retrieve it within 30 days simply by signing in normally.", { duration: 7000 });
    }
  }, [searchParams]);
  return null;
}

export default function UserLoginPage() {
    return (
        <Suspense fallback={null}>
            <AuthErrorNotifier />
            <UserLoginForm />
        </Suspense>
    );
}

function UserLoginForm() {
    const router = useRouter();
    const [showPw, setShowPw] = useState(false);
    const [needsLinkedIn, setNeedsLinkedIn] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setNeedsLinkedIn(false);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "user" }),
        credentials: "include",
      });
      const json = await res.json();
      if (json.code === "linkedin_required") { setNeedsLinkedIn(true); return; }
      if (!res.ok) throw new Error(json.error || "Login failed");
      if (json.notice) {
        toast.info(json.notice, { duration: 6000 });
      } else {
        toast.success("Welcome back!");
      }
      // Back to where the visitor was heading, else last active tab from localStorage, else the overview
      const nextParam = new URLSearchParams(window.location.search).get("next");
      const storedTab = typeof window !== "undefined" ? localStorage.getItem("ifind_student_last_tab") : null;
      const uname = json.data?.username ?? "me";
      if (!nextParam && storedTab && storedTab.startsWith(`/user/${uname}/`)) {
        router.push(storedTab);
      } else {
        router.push(resolveNext(nextParam, uname));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    }
  };

  return (
    <AuthShell
      heading="Sign in to iFind"
      sub="Find your next internship"
      switchText="Don't have an account?"
      switchLink="/user/register"
      switchLabel="Register free"
    >
      {needsLinkedIn && (
        <div role="alert" className="mb-4 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-sm text-[var(--danger)]">
          <p className="font-semibold">This user needs to login using LinkedIn to use the password again.</p>
          <p className="mt-1 text-xs">Accounts with both a password and LinkedIn must sign in with LinkedIn about once a month. Sign in with LinkedIn below, then your password works again.</p>
        </div>
      )}
      <form method="POST" onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }} className="space-y-4">
        <Input
          label="Email or Username"
          placeholder="you@example.com"
          {...register("identifier")}
          error={errors.identifier?.message}
          autoComplete="username"
        />
        <Input
          label="Password"
          type={showPw ? "text" : "password"}
          placeholder="Your password"
          {...register("password")}
          error={errors.password?.message}
          autoComplete="current-password"
          rightIcon={
            <button type="button" onClick={() => setShowPw(!showPw)} className="text-[var(--text-3)] hover:text-[var(--text)]">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="flex justify-end -mt-1">
          <Link href="#" className="text-xs text-[var(--primary)] hover:underline">Forgot password?</Link>
        </div>

                <Button
                    type="submit"
                    loading={isSubmitting}
                    className="w-full gap-2"
                    size="md"
                >
                    Sign In <ArrowRight className="h-3.5 w-3.5" />
                </Button>

            </form>

            <div className="space-y-3">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[var(--border)]" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="text-xs text-[var(--text-3)] bg-[var(--surface)] px-3">
                            or continue with
                        </span>
                    </div>
                </div>

                <LinkedInButton />
            </div>
        </AuthShell>
    );
}
