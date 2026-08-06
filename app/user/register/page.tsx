"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Check, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";
import { toast }  from "sonner";
import { AuthShell, GoogleButton } from "@/app/user/login/page";
import { LinkedInButton } from "@/components/auth/LinkedInButton";

const schema = z.object({
  name:     z.string().min(2, "At least 2 characters"),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/, "Lowercase, numbers, underscores only"),
  email:    z.string().email("Valid email required"),
  password: z.string().min(8).regex(/[A-Z]/, "Needs uppercase").regex(/[0-9]/, "Needs number"),
  city:     z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function UserRegisterPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const pw = watch("password", "");
  const checks = { length: pw.length >= 8, uppercase: /[A-Z]/.test(pw), number: /[0-9]/.test(pw) };

  const onSubmit = async (data: Form) => {
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "user" }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      toast.success("Account created! Welcome to iFind 🎉");
      router.push(`/user/${data.username}/overview`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <AuthShell
      heading="Create your account"
      sub="Join 2M+ students finding internships"
      icon={<GraduationCap className="h-4.5 w-4.5 text-white" />}
      switchText="Already have an account?"
      switchLink="/user/login"
      switchLabel="Sign in"
      portalLabel="Employer portal"
      portalHref="/employer/register"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Full Name"  placeholder="Rahul Sharma"    {...register("name")}     error={errors.name?.message}     autoComplete="name" />
        <Input label="Username"   placeholder="rahulsharma"     {...register("username")} error={errors.username?.message} autoComplete="username" />
        <Input label="Email"      placeholder="you@example.com" type="email" {...register("email")} error={errors.email?.message} autoComplete="email" />

        <div>
          <Input
            label="Password"
            type={showPw ? "text" : "password"}
            placeholder="Min 8, 1 uppercase, 1 number"
            {...register("password")}
            error={errors.password?.message}
            autoComplete="new-password"
            rightIcon={
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          {pw && (
            <div className="mt-2 space-y-1">
              {([ ["length","8+ chars"],["uppercase","Uppercase"],["number","Number"] ] as [keyof typeof checks, string][]).map(([k, l]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <Check className={`h-3 w-3 ${checks[k] ? "text-green-500" : "text-[var(--border-2)]"}`} />
                  <span className={`text-xs ${checks[k] ? "text-green-600" : "text-[var(--text-3)]"}`}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Input label="City (optional)" placeholder="Bangalore" {...register("city")} />

        <Button type="submit" loading={isSubmitting} className="w-full gap-2" size="md">
          Create Account <ArrowRight className="h-3.5 w-3.5" />
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

      <p className="text-xs text-[var(--text-3)] text-center">
        By registering you agree to our{" "}
        <Link href="#" className="text-[var(--primary)] hover:underline">Terms</Link> &{" "}
        <Link href="#" className="text-[var(--primary)] hover:underline">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
