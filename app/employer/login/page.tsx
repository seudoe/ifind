"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";
import { toast }  from "sonner";
import { LinkedInButton } from "@/components/auth/LinkedInButton";

const schema = z.object({
  email:      z.string().min(1, "Email is required"),
  password:   z.string().min(1, "Password is required"),
});
type Form = z.infer<typeof schema>;

export default function EmployerLoginPage() {
  const router = useRouter();
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) toast.error(err);
  }, []);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      const res  = await fetch("/api/employer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      toast.success("Welcome back!");
      router.push("/employer/companies");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    }
  };

  return (
    <AuthLayout
      variant="employer"
      heading="Employer sign in"
      sub="Access your hiring dashboard"
      back={{ href: "/employer", label: "Employer portal" }}
      footer={
        <span>
          No account? <Link href="/employer/register" className="text-[var(--primary)] font-medium hover:underline">Register</Link>
        </span>
      }
    >
      <div className="plasma-card p-6">
          <form method="POST" onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }} className="space-y-4">
            <Input
              label="Email"
              placeholder="company@example.com"
              type="email"
              {...register("email")}
              error={errors.email?.message}
              autoComplete="email"
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
          <div className="flex items-center gap-3 my-4 text-xs text-[var(--text-3)]">
            <span className="h-px flex-1 bg-[var(--border)]" />or<span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <LinkedInButton as="employer" />
        </div>
    </AuthLayout>
  );
}
