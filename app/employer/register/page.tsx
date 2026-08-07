"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";
import { toast }  from "sonner";

const schema = z.object({
  companyName: z.string().min(2, "Company name required"),
  username:    z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/, "Lowercase, numbers, hyphens only"),
  email:       z.string().email("Valid email required"),
  password:    z.string().min(8).regex(/[A-Z]/, "Needs uppercase").regex(/[0-9]/, "Needs number"),
  website:     z.string().url("Enter a valid URL").optional().or(z.literal("")),
});
type Form = z.infer<typeof schema>;

export default function EmployerRegisterPage() {
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
        body: JSON.stringify({ ...data, role: "employer" }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      toast.success("Company account created!");
      router.push(`/employer/${data.username}/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4 py-10">
      <Link href="/employer" className="fixed top-4 left-4 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
        ← Employer portal
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--primary)] items-center justify-center shadow-sm mb-3">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text)]">Create employer account</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">Start hiring top student talent</p>
        </div>

        <div className="plasma-card p-6">
          <form method="POST" onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }} className="space-y-3">
            <Input label="Company Name"      placeholder="Acme Corp"           {...register("companyName")} error={errors.companyName?.message} />
            <Input label="Handle / Username" placeholder="acmecorp"            {...register("username")}    error={errors.username?.message}    autoComplete="username" />
            <Input label="Work Email"        placeholder="hr@acmecorp.com"     type="email" {...register("email")} error={errors.email?.message} autoComplete="email" />
            <Input label="Website (optional)" placeholder="https://acmecorp.com" {...register("website")} error={errors.website?.message} />

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
                  {([["length","8+ chars"],["uppercase","Uppercase"],["number","Number"]] as [keyof typeof checks, string][]).map(([k, l]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <Check className={`h-3 w-3 ${checks[k] ? "text-green-500" : "text-[var(--border-2)]"}`} />
                      <span className={`text-xs ${checks[k] ? "text-green-600" : "text-[var(--text-3)]"}`}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full gap-2 mt-1" size="md">
              Create Account <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          <p className="text-xs text-[var(--text-3)] text-center mt-4">
            By registering you agree to our{" "}
            <Link href="#" className="text-[var(--primary)] hover:underline">Terms</Link> &{" "}
            <Link href="#" className="text-[var(--primary)] hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        <div className="flex items-center justify-between mt-5 text-sm text-[var(--text-3)]">
          <span>Already registered? <Link href="/employer/login" className="text-[var(--primary)] font-medium hover:underline">Sign in</Link></span>
          <Link href="/user/register" className="text-xs hover:text-[var(--primary)] transition-colors">Student portal →</Link>
        </div>
      </div>
    </div>
  );
}
