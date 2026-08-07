"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";
import { toast }  from "sonner";
import { LinkedInButton } from "@/components/auth/LinkedInButton";

const schema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password:   z.string().min(1, "Password is required"),
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

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "user" }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      if (json.notice) {
        toast.info(json.notice, { duration: 6000 });
      } else {
        toast.success("Welcome back!");
      }
      // Redirect to user's overview — middleware will handle auth guard
      router.push(`/user/${json.data?.username ?? "me"}/overview`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    }
  };

  return (
    <AuthShell
      heading="Sign in to iFind"
      sub="Find your next internship"
      icon={<GraduationCap className="h-4.5 w-4.5 text-white" />}
      switchText="Don't have an account?"
      switchLink="/user/register"
      switchLabel="Register free"
      portalLabel="Employer portal"
      portalHref="/employer/login"
    >
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

        <Button type="submit" loading={isSubmitting} className="w-full gap-2" size="md">
          Sign In <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </form>

      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="text-xs text-[var(--text-3)] bg-[var(--surface)] px-3">or continue with</span>
          </div>
        </div>

        <LinkedInButton />
        <GoogleButton />
      </div>
    </AuthShell>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

export function AuthShell({
  heading, sub, icon, switchText, switchLink, switchLabel, portalLabel, portalHref, children,
}: {
  heading: string; sub: string; icon: React.ReactNode;
  switchText: string; switchLink: string; switchLabel: string;
  portalLabel: string; portalHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <Link href="/" className="fixed top-4 left-4 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
        ← iFind
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--primary)] items-center justify-center shadow-sm mb-3">
            {icon}
          </div>
          <h1 className="text-lg font-bold text-[var(--text)]">{heading}</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">{sub}</p>
        </div>

        <div className="plasma-card p-6 space-y-4">
          {children}
        </div>

        <div className="flex items-center justify-between mt-5 text-sm text-[var(--text-3)]">
          <span>{switchText} <Link href={switchLink} className="text-[var(--primary)] font-medium hover:underline">{switchLabel}</Link></span>
          <Link href={portalHref} className="text-xs hover:text-[var(--primary)] transition-colors">{portalLabel} →</Link>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton() {
  return (
    <button
      type="button"
      onClick={() => { import("sonner").then(({ toast }) => toast.info("Google login coming soon")); }}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-[var(--transition)] font-medium"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  );
}

